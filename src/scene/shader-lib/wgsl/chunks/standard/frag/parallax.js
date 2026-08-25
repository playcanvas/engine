export default /* wgsl */`
uniform material_heightMapFactor: f32;

#if STD_PARALLAX == OCCLUSION
    uniform material_parallaxSamples: f32;

    // How far the ray may travel across the texture, as a multiple of the depth of the height field.
    // The limit is what bounds how far the lookup slides along the surface at a grazing angle, and
    // that slide is what makes the relief appear to swim as the camera moves - the geometry never
    // moves, only the texture lookup does. Raising it deepens grazing relief and increases the swim.
    // Measured on rolling terrain, the slide varied by 0.26 world units over a small camera move at
    // 10, 0.17 at 3 and 0.03 at 1.5, against a relief only 0.25 deep.
    const parallaxMaxSlope: f32 = 5.0;

    // texels of the mip being read that a single step aims to cover
    const parallaxTexelsPerStep: f32 = 2.0;

    // the march fades out between these two lengths, measured in texels of the mip being read
    const parallaxFadeMin: f32 = 1.0;
    const parallaxFadeMax: f32 = 3.0;

    // halvings of the bracketing step used to place the hit
    const parallaxRefineSteps: i32 = 5;
#endif

fn getParallax() {
    var parallaxScale = uniform.material_heightMapFactor;

    // view direction in tangent space, pointing from the surface towards the camera
    var viewDirT: vec3f = normalize(dViewDirW * dTBN);

    // The y axis of the tangent frame points along decreasing v, which is the tangent space
    // convention normal maps are authored in, so the v component is negated to give the direction
    // the surface is viewed from in uv space.
    var viewDirUv: vec2f = vec2f(viewDirT.x, -viewDirT.y);

    #if STD_PARALLAX == OCCLUSION

        // Parallax occlusion mapping. The height map is treated as depth below the original
        // geometry - white sits at the level of the geometry and black is parallaxScale deep - and
        // the view ray is marched through that volume until it passes below the height field. Note
        // this reads the map differently to the OFFSET mode above, which pivots the surface around
        // the mid-grey level instead.

        // The uv the ray travels while descending through the whole depth range: the depth scale
        // times the tangent of the view angle, pointing away from the camera as the ray descends.
        let march: vec2f = -parallaxScale * viewDirUv / max(viewDirT.z, 0.0001);

        // That distance grows without bound as the view flattens onto the surface, so it is limited
        // to a multiple of the depth. Past the limit the relief stops deepening, in the same spirit
        // as the offset limiting of the single tap mode: left unlimited the march covers more of the
        // texture than any sample budget can resolve.
        let marchLength: f32 = length(march);
        let maxMarchLength: f32 = parallaxScale * parallaxMaxSlope;
        let uvSpan: vec2f = select(march, march * (maxMarchLength / marchLength), marchLength > maxMarchLength);

        // The mip level the march reads. Every tap uses an explicit level because the loop below is
        // non-uniform control flow, where the implicit derivatives an automatic level needs are
        // undefined - WGSL reports that as a derivative_uniformity diagnostic - and because it says
        // how much detail the map can resolve here, which sets both the step count and the fade.
        let heightMapSize: vec2f = vec2f(textureDimensions({STD_HEIGHT_TEXTURE_NAME}, 0));
        let uvTexels: vec2f = {STD_HEIGHT_TEXTURE_UV} * heightMapSize;
        let texelsDx: vec2f = dpdx(uvTexels);
        let texelsDy: vec2f = dpdy(uvTexels);
        let lod: f32 = max(0.0, 0.5 * log2(max(dot(texelsDx, texelsDx), dot(texelsDy, texelsDy))));

        // How much of the map the march actually crosses, in texels of that mip. A coarser mip holds
        // proportionally less detail, so this shrinks as the surface recedes even though the march
        // covers the same uv - which is what makes the effect cheaper with distance.
        let marchTexels: f32 = length(uvSpan * heightMapSize) / exp2(lod);

        // Once the march covers barely a texel there is no detail left to displace, so fade it out
        // rather than spending taps resolving noise.
        let fade: f32 = clamp((marchTexels - parallaxFadeMin) / (parallaxFadeMax - parallaxFadeMin), 0.0, 1.0);

        dUvOffset = vec2f(0.0);

        if (fade > 0.0) {

            // The step count follows the detail actually being crossed rather than the view angle,
            // so it accounts for the depth scale and the distance as well.
            // material_parallaxSamples is the budget it is capped to. The count is deliberately not
            // rounded up: quantizing it makes the step size jump from one whole number of steps to
            // the next, which shows up as bands with a visible seam between them.
            let steps: f32 = clamp(marchTexels / parallaxTexelsPerStep, 1.0, uniform.material_parallaxSamples);
            let stepSize: f32 = 1.0 / steps;

            // The depth of the height field where the ray enters the surface. This is the near end
            // of the first bracket the search tests - starting it at zero instead would resolve the
            // intersection to the surface itself whenever the first step already lands below the
            // height field, removing the offset entirely wherever a single step is taken.
            var rayDepth: f32 = 0.0;
            var surfaceDepth: f32 = 1.0 - textureSampleLevel({STD_HEIGHT_TEXTURE_NAME}, {STD_HEIGHT_TEXTURE_NAME}Sampler, {STD_HEIGHT_TEXTURE_UV}, lod).{STD_HEIGHT_TEXTURE_CHANNEL};
            var prevRayDepth: f32 = rayDepth;
            var prevSurfaceDepth: f32 = surfaceDepth;

            // linear search for the first step which ends up below the height field
            for (var i: f32 = 0.0; i < steps; i += 1.0) {
                if (rayDepth >= surfaceDepth) {
                    break;
                }

                prevRayDepth = rayDepth;
                prevSurfaceDepth = surfaceDepth;

                rayDepth += stepSize;
                surfaceDepth = 1.0 - textureSampleLevel({STD_HEIGHT_TEXTURE_NAME}, {STD_HEIGHT_TEXTURE_NAME}Sampler, {STD_HEIGHT_TEXTURE_UV} + uvSpan * rayDepth, lod).{STD_HEIGHT_TEXTURE_CHANNEL};
            }

            // The ray crossed the surface somewhere inside the last step, so refine within it. Each
            // iteration halves the interval and takes a fresh sample of the height field, which is
            // what separates this from interpolating between the two ends of the step: an
            // interpolation assumes the surface runs straight between them, and at a shallow view
            // angle a single step spans several features of the map, so the hit snaps to the step
            // grid. That is the terracing seen on a floor viewed from low down. Five halvings place
            // the hit within a sixty-fourth of a step for five taps, which no affordable number of
            // linear steps matches.
            var hitDepth: f32 = rayDepth;

            // skip the refinement when the ray left the depth range without ever crossing the field
            if (rayDepth >= surfaceDepth) {
                var interval: f32 = (rayDepth - prevRayDepth) * 0.5;

                // the middle of the bracket, which halves the error before any tap is spent
                hitDepth = rayDepth - interval;

                // Refining is what carries the accuracy here: skipping it once a step covers only a
                // couple of texels was measured as a large regression, so it always runs.
                for (var i: i32 = 0; i < parallaxRefineSteps; i++) {
                    interval *= 0.5;
                    let refineDepth: f32 = 1.0 - textureSampleLevel({STD_HEIGHT_TEXTURE_NAME}, {STD_HEIGHT_TEXTURE_NAME}Sampler, {STD_HEIGHT_TEXTURE_UV} + uvSpan * hitDepth, lod).{STD_HEIGHT_TEXTURE_CHANNEL};

                    // below the height field, step back towards the surface, otherwise go deeper
                    hitDepth += select(interval, -interval, hitDepth >= refineDepth);
                }
            }

            dUvOffset = uvSpan * clamp(hitDepth, 0.0, 1.0) * fade;
        }

    #else

        var height: f32 = textureSampleBias({STD_HEIGHT_TEXTURE_NAME}, {STD_HEIGHT_TEXTURE_NAME}Sampler, {STD_HEIGHT_TEXTURE_UV}, uniform.textureBias).{STD_HEIGHT_TEXTURE_CHANNEL};

        // remap the height to be relative to the mid-level of the height map, so the surface pivots
        // around the original geometry instead of floating in front of it
        height = height * parallaxScale - parallaxScale * 0.5;

        // Parallax mapping with offset limiting (Welsh 2004). The geometrically correct offset is
        // height * viewDirUv / viewDirT.z, but the 1/z term explodes at grazing angles and smears
        // the texture. Dropping it limits the offset to the height itself, which is stable at all
        // viewing angles at the cost of understating the parallax when looking along the surface.
        dUvOffset = height * viewDirUv;

    #endif
}
`;
