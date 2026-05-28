export default /* wgsl */`
    #include "sampleCatmullRomPS"
    #include "screenDepthPS"

    var sourceTexture: texture_2d<f32>;
    var sourceTextureSampler: sampler;
    var historyTexture: texture_2d<f32>;
    var historyTextureSampler: sampler;
    uniform matrix_viewProjectionPrevious: mat4x4f;
    uniform matrix_viewProjectionInverse: mat4x4f;
    uniform jitters: vec4f;   // xy: current frame, zw: previous frame
    uniform textureSize: vec2f;

    varying uv0: vec2f;

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

        // flip result back to texture sampling convention
        var result = (screenPrevious.xy / screenPrevious.w) * 0.5 + 0.5;
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

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // current frame
        let srcColor = textureSample(sourceTexture, sourceTextureSampler, uv0);

        // current depth is in linear space, convert it to non-linear space
        let linearDepth = getLinearScreenDepth(uv0);
        let depth = delinearizeDepth(linearDepth);

        // previous frame
        let historyUv = reproject(uv0, depth);

        #ifdef QUALITY_HIGH

            var historySample: vec4f = SampleTextureCatmullRom(historyTexture, historyTextureSampler, historyUv, uniform.textureSize);

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

        let historyPremulClamped = colorClampPremul(uv0, historyPremul);

        let mixFactor_condition = historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0;
        let mixFactor = select(0.05, 1.0, mixFactor_condition);

        let mixedPremul = mix(historyPremulClamped, srcPremul, mixFactor);
        let a = srcColor.a;
        // UNORM8 alpha step — avoid un-premul in the lowest band (quantization / noise).
        let UNPREMUL_EPS = 1.0 / 255.0;
        let rgbStraight = select(srcColor.rgb, mixedPremul / a, a > UNPREMUL_EPS);
        output.color = vec4f(rgbStraight, a);
        return output;
    }
`;
