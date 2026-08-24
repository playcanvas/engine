export default /* wgsl */`
uniform material_heightMapFactor: f32;

#if STD_PARALLAX == OCCLUSION
    uniform material_parallaxSamples: f32;

    // How far the ray may travel across the texture, as a multiple of the depth of the height
    // field, and the uv distance a single step aims to cover - roughly two texels of a 1k map.
    const parallaxMaxSlope: f32 = 10.0;
    const parallaxUvPerStep: f32 = 1.0 / 512.0;

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

        // The step count follows the distance actually being marched rather than the view angle, so
        // that it accounts for the depth scale too - a shallow height map needs fewer taps than a
        // deep one at the same angle. material_parallaxSamples is the budget it is capped to. The
        // count is deliberately not rounded up: quantizing it makes the step size jump from one
        // whole number of steps to the next, which shows up on a curved surface as bands of constant
        // sample count with a visible seam between them.
        let steps: f32 = clamp(length(uvSpan) / parallaxUvPerStep, 1.0, uniform.material_parallaxSamples);
        let stepSize: f32 = 1.0 / steps;

        // The depth of the height field where the ray enters the surface. This is the near end of
        // the first bracket the search tests - starting it at zero instead would resolve the
        // intersection to the surface itself whenever the first step already lands below the height
        // field, removing the offset entirely wherever a single step is taken.
        var rayDepth: f32 = 0.0;
        var surfaceDepth: f32 = 1.0 - textureSampleLevel({STD_HEIGHT_TEXTURE_NAME}, {STD_HEIGHT_TEXTURE_NAME}Sampler, {STD_HEIGHT_TEXTURE_UV}, 0.0).{STD_HEIGHT_TEXTURE_CHANNEL};
        var prevRayDepth: f32 = rayDepth;
        var prevSurfaceDepth: f32 = surfaceDepth;

        // Linear search for the first step which ends up below the height field. The height map is
        // sampled at an explicit mip level: the loop is non-uniform control flow, where the implicit
        // derivatives an automatic level needs are undefined - WGSL reports that as a
        // derivative_uniformity diagnostic.
        for (var i: f32 = 0.0; i < steps; i += 1.0) {
            if (rayDepth >= surfaceDepth) {
                break;
            }

            prevRayDepth = rayDepth;
            prevSurfaceDepth = surfaceDepth;

            rayDepth += stepSize;
            surfaceDepth = 1.0 - textureSampleLevel({STD_HEIGHT_TEXTURE_NAME}, {STD_HEIGHT_TEXTURE_NAME}Sampler, {STD_HEIGHT_TEXTURE_UV} + uvSpan * rayDepth, 0.0).{STD_HEIGHT_TEXTURE_CHANNEL};
        }

        // The ray crossed the surface somewhere inside the last step, so refine within it. Each
        // iteration halves the interval and takes a fresh sample of the height field, which is what
        // separates this from interpolating between the two ends of the step: an interpolation
        // assumes the surface runs straight between them, and at a shallow view angle a single step
        // spans several features of the map, so the hit snaps to the step grid. That is the
        // terracing seen on a floor viewed from low down. Five halvings place the hit within a
        // sixty-fourth of a step for five taps, which no affordable number of linear steps matches.
        var hitDepth: f32 = rayDepth;

        // skip the refinement when the ray left the depth range without ever crossing the field
        if (rayDepth >= surfaceDepth) {
            var interval: f32 = (rayDepth - prevRayDepth) * 0.5;
            hitDepth = rayDepth - interval;

            for (var i: i32 = 0; i < parallaxRefineSteps; i++) {
                interval *= 0.5;
                let refineDepth: f32 = 1.0 - textureSampleLevel({STD_HEIGHT_TEXTURE_NAME}, {STD_HEIGHT_TEXTURE_NAME}Sampler, {STD_HEIGHT_TEXTURE_UV} + uvSpan * hitDepth, 0.0).{STD_HEIGHT_TEXTURE_CHANNEL};

                // below the height field, step back towards the surface, otherwise go deeper
                hitDepth += select(interval, -interval, hitDepth >= refineDepth);
            }
        }

        dUvOffset = uvSpan * clamp(hitDepth, 0.0, 1.0);

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
