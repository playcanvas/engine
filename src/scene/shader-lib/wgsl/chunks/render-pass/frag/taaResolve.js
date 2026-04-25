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

    fn colorClamp(uv: vec2f, historyColor: vec4f) -> vec4f {

        // out of range numbers
        var minColor = vec3f(9999.0);
        var maxColor = vec3f(-9999.0);

        // sample a 3x3 neighborhood
        for (var ix: i32 = -1; ix <= 1; ix = ix + 1) {
            for (var iy: i32 = -1; iy <= 1; iy = iy + 1) {
                let color_sample = textureSample(sourceTexture, sourceTextureSampler, uv + vec2f(f32(ix), f32(iy)) / uniform.textureSize).rgb;
                minColor = min(minColor, color_sample);
                maxColor = max(maxColor, color_sample);
            }
        }

        // clamp the history color to min/max bounding box
        let clamped = clamp(historyColor.rgb, minColor, maxColor);
        return vec4f(clamped, historyColor.a);
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

            // high quality history, sharper result
            var historyColor: vec4f = SampleTextureCatmullRom(historyTexture, historyTextureSampler, historyUv, uniform.textureSize);

        #else

            // single sample history, more blurry result
            var historyColor: vec4f = textureSample(historyTexture, historyTextureSampler, historyUv);

        #endif

        // handle disocclusion by clamping the history color
        let historyColorClamped = colorClamp(uv0, historyColor);

        // handle history buffer outside of the frame
        let mixFactor_condition = historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0;
        let mixFactor = select(0.05, 1.0, mixFactor_condition);

        output.color = mix(historyColorClamped, srcColor, mixFactor);
        return output;
    }
`;
