export default /* wgsl */`
    #include "sampleCatmullRomPS"
    #include "reversibleTonemapPS"
    #include "screenDepthPS"

    var sourceTexture: texture_2d<f32>;
    var sourceTextureSampler: sampler;
    var historyTexture: texture_2d<f32>;
    var historyTextureSampler: sampler;
    uniform matrix_viewProjectionPrevious: mat4x4f;
    uniform matrix_viewProjectionInverse: mat4x4f;
    uniform taaExposure: f32;   // the exposure the scene is displayed with
    uniform jitters: vec4f;   // xy: current frame, zw: previous frame
    uniform textureSize: vec2f;
    uniform historySize: vec2f;

    varying uv0: vec2f;

    // the most of the current frame taken while the camera moves the surface of a pixel across the
    // screen, and the motion from which it is taken, in pixels of the history
    const TAA_MOTION_BLEND: f32 = 0.5;
    const TAA_MOTION_PIXELS: f32 = 32.0;

    fn reproject(uv_in: vec2f, depth: f32) -> vec2f {

        // uv was Y-flipped by getImageEffectUV for texture sampling,
        // un-flip to reconstruct correct NDC (viewProj matrices use standard Y convention)
        var uv = vec2f(uv_in.x, 1.0 - uv_in.y);

        var ndc = vec4f(uv * 2.0 - 1.0, depth, 1.0);

        // remove jitter from the current frame
        ndc = vec4f(ndc.xy - uniform.jitters.xy, ndc.zw);

        // Transform NDC to world space of the current frame
        var worldPosition = uniform.matrix_viewProjectionInverse * ndc;
        worldPosition = worldPosition / worldPosition.w;

        // world position to screen space of the previous frame
        let screenPrevious = uniform.matrix_viewProjectionPrevious * worldPosition;

        // remove the jitter of the previous frame, as the history holds the image without it, and
        // flip the result back to texture sampling convention
        var result = (screenPrevious.xy / screenPrevious.w + uniform.jitters.zw) * 0.5 + 0.5;
        result.y = 1.0 - result.y;

        return result;
    }

    fn colorClampPremul(uv: vec2f, historyPremul: vec3f) -> vec3f {

        var minPremul = vec3f(9999.0);
        var maxPremul = vec3f(-9999.0);

        // 3x3 neighborhood in premultiplied space — same domain as the temporal mix (see fragmentMain).
        for (var ix: i32 = -1; ix <= 1; ix = ix + 1) {
            for (var iy: i32 = -1; iy <= 1; iy = iy + 1) {
                let s = textureSample(sourceTexture, sourceTextureSampler, uv + vec2f(f32(ix), f32(iy)) / uniform.textureSize);
                let premul = s.rgb * s.a;
                minPremul = min(minPremul, premul);
                maxPremul = max(maxPremul, premul);
            }
        }

        return clamp(historyPremul, minPremul, maxPremul);
    }

    #ifdef TAA_UPSCALE

        struct UpscaleSample {
            color: vec4f,
            weight: f32,
            minPremul: vec3f,
            maxPremul: vec3f
        };

        // The current frame renders at a lower resolution than the history. Each of its texels holds
        // the image at its center moved by the jitter of the frame, so from frame to frame its sample
        // lands at a different position within the pixels of the history. The current color at this
        // pixel is reconstructed from the texels around it, weighted by how close their samples are
        // to it, and the weight of the nearest decides how much of it the history takes - over the
        // jitter sequence, each pixel of the history accumulates the samples landing on it.
        fn upscaleCurrent(uv: vec2f) -> UpscaleSample {

            // this pixel and the jitter, in texels of the current frame - uv is Y-flipped for
            // texture sampling, and so is the jitter
            let position = uv * uniform.textureSize;
            let jitter = vec2f(uniform.jitters.x, -uniform.jitters.y) * 0.5 * uniform.textureSize;

            // the texel whose sample is nearest to this pixel
            let nearest = floor(position - jitter);

            // pixels of the history per texel of the current frame
            let scale = uniform.historySize.x / uniform.textureSize.x;

            var result: UpscaleSample;
            var sum = vec4f(0.0);
            var sumWeight: f32 = 0.0;
            var nearestColor = vec4f(0.0);
            result.weight = 0.0;
            result.minPremul = vec3f(9999.0);
            result.maxPremul = vec3f(-9999.0);
            for (var ix: i32 = -1; ix <= 1; ix = ix + 1) {
                for (var iy: i32 = -1; iy <= 1; iy = iy + 1) {
                    let texel = nearest + vec2f(f32(ix), f32(iy));
                    let s = textureSampleLevel(sourceTexture, sourceTextureSampler, (texel + 0.5) / uniform.textureSize, 0.0);
                    let premul = s.rgb * s.a;
                    result.minPremul = min(result.minPremul, premul);
                    result.maxPremul = max(result.maxPremul, premul);
                    if (ix == 0 && iy == 0) {
                        nearestColor = s;
                    }

                    // the distance of its sample to this pixel, in pixels of the history
                    let d = (texel + 0.5 + jitter - position) * scale;
                    let w = exp(-2.29 * dot(d, d));
                    sum = sum + s * w;
                    sumWeight = sumWeight + w;
                    result.weight = max(result.weight, w);
                }
            }
            result.color = select(nearestColor, sum / max(sumWeight, 1e-6), sumWeight > 1e-4);
            return result;
        }

    #endif

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // current frame
        #ifdef TAA_UPSCALE
            let upscaled = upscaleCurrent(uv0);
            let srcColor = upscaled.color;
        #else
            let srcColor = textureSample(sourceTexture, sourceTextureSampler, uv0);
        #endif

        // current depth is in linear space, convert it to non-linear space
        let linearDepth = getLinearScreenDepth(uv0);
        let depth = delinearizeDepth(linearDepth);

        // previous frame
        let historyUv = reproject(uv0, depth);

        #ifdef QUALITY_HIGH

            var historySample: vec4f = SampleTextureCatmullRom(historyTexture, historyTextureSampler, historyUv, uniform.historySize);

        #else

            var historySample: vec4f = textureSample(historyTexture, historyTextureSampler, historyUv);

        #endif

        // Premultiplied (rgb * a) is the coverage-correct space for TAA: straight RGB interpolates
        // uncorrelated color and opacity at edges, which causes colored fringes and alpha-related
        // ghosting when history is blended or clamped against a 3x3 neighborhood. We clamp and mix
        // in premultiplied space, then un-premultiply once using the current frame's alpha only
        // (alpha is not temporally filtered — output stays tied to this frame's coverage).
        let historyPremul = historySample.rgb * historySample.a;
        let srcPremul = srcColor.rgb * srcColor.a;

        #ifdef TAA_UPSCALE
            // clamped to the range of the texels around this pixel, and taking more of the current
            // frame the closer its nearest sample is to this pixel
            let historyPremulClamped = clamp(historyPremul, upscaled.minPremul, upscaled.maxPremul);
            let baseBlend = 0.1 * upscaled.weight;
        #else
            let historyPremulClamped = colorClampPremul(uv0, historyPremul);
            let baseBlend: f32 = 0.05;
        #endif

        // The further the history of this pixel was reprojected from, the faster the camera moves its
        // surface across the screen: the history has been resampled further, which blurs it, and it is
        // more likely not to hold this surface at all. The current frame is then taken more of, up to
        // TAA_MOTION_BLEND from a motion of TAA_MOTION_PIXELS pixels of the history - while the camera
        // is still, the history accumulates as before.
        let motion = length((uv0 - historyUv) * uniform.historySize);
        let blend = mix(baseBlend, max(baseBlend, TAA_MOTION_BLEND), clamp(motion / TAA_MOTION_PIXELS, 0.0, 1.0));

        let mixFactor_condition = historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0;
        let mixFactor = select(blend, 1.0, mixFactor_condition);

        // The history and the current frame are blended compressed by a reversible tone mapping of
        // their exposed values. Blended in linear HDR, the samples of a bright surface partially
        // covering a pixel dominate its average, which the tone mapping then displays nearly as
        // bright as the surface - the edges of bright geometry would stay thick and aliased.
        let e = max(uniform.taaExposure, 1e-6);
        let mixedPremul = reversibleTonemapInverse(mix(reversibleTonemap(historyPremulClamped * e), reversibleTonemap(srcPremul * e), mixFactor)) / e;
        let a = srcColor.a;
        // UNORM8 alpha step — avoid un-premul in the lowest band (quantization / noise).
        let UNPREMUL_EPS = 1.0 / 255.0;
        let rgbStraight = select(srcColor.rgb, mixedPremul / a, a > UNPREMUL_EPS);
        output.color = vec4f(rgbStraight, a);
        return output;
    }
`;
