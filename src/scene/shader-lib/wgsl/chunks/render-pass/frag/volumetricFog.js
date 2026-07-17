export default /* wgsl */`
    #include "screenDepthPS"

    varying uv0: vec2f;

    uniform uFogCameraPos: vec3f;
    uniform uFogCameraFwd: vec3f;
    uniform uFogInvView: mat4x4f;
    uniform uFogProjScale: vec2f;
    uniform uFogTint: vec3f;
    uniform uFogLightColor: vec3f;
    uniform uFogLightDir: vec3f;      // world space direction towards the light
    uniform uFogAmbient: vec3f;
    uniform uFogParams: vec4f;        // x: density, y: height base, z: height falloff, w: max distance
    uniform uFogScatterParams: vec4f; // x: anisotropy, y: step count, z: temporal noise offset, w: shadow intensity

    #ifdef FOG_SHADOWS
        uniform uFogShadowMatrixPalette: array<mat4x4f, 4>;
        uniform uFogShadowCascadeDistances: vec4f;
        uniform uFogShadowParams: vec4f; // x: cascade count, y: bias, z: unused, w: max shadow distance
        #ifdef FOG_SHADOW_PCF
            var uFogShadowMap: texture_depth_2d;
            var uFogShadowMapSampler: sampler_comparison;
        #else
            var uFogShadowMap: texture_2d<f32>;
            var uFogShadowMapSampler: sampler;
        #endif

        fn sampleFogShadow(worldPos: vec3f, viewDepth: f32) -> f32 {

            // no shadow past the shadow distance
            if (viewDepth >= uniform.uFogShadowParams.w) {
                return 1.0;
            }

            // cascade index based on the view depth
            let comparisons: vec4f = step(uniform.uFogShadowCascadeDistances, vec4f(viewDepth));
            let cascadeIndex: i32 = i32(min(dot(comparisons, vec4f(1.0)), uniform.uFogShadowParams.x - 1.0));

            let shadowCoord: vec3f = (uniform.uFogShadowMatrixPalette[cascadeIndex] * vec4f(worldPos, 1.0)).xyz;
            let z: f32 = shadowCoord.z - uniform.uFogShadowParams.y;

            #ifdef FOG_SHADOW_PCF
                // hardware comparison on the depth format shadow map
                return textureSampleCompareLevel(uFogShadowMap, uFogShadowMapSampler, shadowCoord.xy, z);
            #else
                // manual comparison on the color format shadow map storing depth (PCSS / VSM)
                return step(z, textureSampleLevel(uFogShadowMap, uFogShadowMapSampler, shadowCoord.xy, 0.0).r);
            #endif
        }
    #endif

    // interleaved gradient noise
    fn fogNoise(fragCoord: vec2f) -> f32 {
        const magic: vec3f = vec3f(0.06711056, 0.00583715, 52.9829189);
        return fract(magic.z * fract(dot(fragCoord, magic.xy)));
    }

    // normalized Henyey-Greenstein phase function
    fn fogPhase(cosTheta: f32, g: f32) -> f32 {
        let g2: f32 = g * g;
        let denom: f32 = 1.0 + g2 - 2.0 * g * cosTheta;
        return (1.0 - g2) / (12.56637 * denom * sqrt(denom));
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // world space ray for this pixel (perspective projection). Note that uv0 addresses
        // textures (getImageEffectUV flips it on WebGPU), so undo the flip to get NDC
        let ndcUV: vec2f = vec2f(input.uv0.x, 1.0 - input.uv0.y);
        let ndc: vec2f = ndcUV * 2.0 - 1.0;
        let rayDir: vec3f = normalize((uniform.uFogInvView * vec4f(ndc * uniform.uFogProjScale, -1.0, 0.0)).xyz);

        // distance along the ray to the scene surface
        let rayDot: f32 = max(dot(rayDir, uniform.uFogCameraFwd), 0.001);
        let rayLength: f32 = min(getLinearScreenDepth(input.uv0) / rayDot, uniform.uFogParams.w);

        let stepCount: f32 = uniform.uFogScatterParams.y;
        let dt: f32 = rayLength / stepCount;

        // per-pixel noise offsets the samples along the ray to hide banding, and cycles over
        // frames when TAA is used to temporally accumulate to a smooth result
        let noise: f32 = fract(fogNoise(pcPosition.xy) + uniform.uFogScatterParams.z);

        // single phase function evaluation, as the light direction is constant along the ray
        let sunLight: vec3f = uniform.uFogLightColor * fogPhase(dot(rayDir, uniform.uFogLightDir), uniform.uFogScatterParams.x);

        var inscatter: vec3f = vec3f(0.0);
        var transmittance: f32 = 1.0;

        for (var i: f32 = 0.0; i < stepCount; i += 1.0) {
            let t: f32 = (i + noise) * dt;
            let pos: vec3f = uniform.uFogCameraPos + rayDir * t;

            // exponential height fog density, constant below the base height
            let density: f32 = uniform.uFogParams.x * exp(-uniform.uFogParams.z * max(pos.y - uniform.uFogParams.y, 0.0));

            var shadow: f32 = 1.0;
            #ifdef FOG_SHADOWS
                shadow = mix(1.0, sampleFogShadow(pos, t * rayDot), uniform.uFogScatterParams.w);
            #endif

            // accumulate in-scattered light and update transmittance (Beer-Lambert)
            let radiance: vec3f = sunLight * shadow + uniform.uFogAmbient;
            inscatter += transmittance * uniform.uFogTint * radiance * (density * dt);
            transmittance *= exp(-density * dt);

            if (transmittance < 0.005) {
                break;
            }
        }

        output.color = vec4f(inscatter, transmittance);
        return output;
    }
`;
