export default /* glsl */`
    #include  "sampleCatmullRomPS"
    #include  "screenDepthPS"

    uniform sampler2D sourceTexture;
    uniform sampler2D historyTexture;
    uniform mat4 matrix_viewProjectionPrevious;
    uniform mat4 matrix_viewProjectionInverse;
    uniform vec4 jitters;   // xy: current frame, zw: previous frame
    uniform vec2 textureSize;

    varying vec2 uv0;

    vec2 reproject(vec2 uv, float depth) {

        // fragment NDC
        #ifndef WEBGPU
            depth = depth * 2.0 - 1.0;
        #endif
        vec4 ndc = vec4(uv * 2.0 - 1.0, depth, 1.0);

        // remove jitter from the current frame
        ndc.xy -= jitters.xy;

        // Transform NDC to world space of the current frame
        vec4 worldPosition = matrix_viewProjectionInverse * ndc;
        worldPosition /= worldPosition.w;

        // world position to screen space of the previous frame
        vec4 screenPrevious = matrix_viewProjectionPrevious * worldPosition;

        return (screenPrevious.xy / screenPrevious.w) * 0.5 + 0.5;
    }

    vec4 colorClamp(vec2 uv, vec4 historyColor) {

        // out of range numbers
        vec3 minColor = vec3(9999.0);
        vec3 maxColor = vec3(-9999.0);

        // sample a 3x3 neighborhood to create a box in color space
        for(float x = -1.0; x <= 1.0; ++x) {
            for(float y = -1.0; y <= 1.0; ++y) {
                vec3 color = texture2D(sourceTexture, uv + vec2(x, y) / textureSize).rgb;
                minColor = min(minColor, color);
                maxColor = max(maxColor, color);
            }
        }

        // clamp the history color to min/max bounding box
        vec3 clamped = clamp(historyColor.rgb, minColor, maxColor);
        return vec4(clamped, historyColor.a);
    }

    void main()
    {
        vec2 uv = uv0;

        #ifdef WEBGPU
            // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // This hack is needed on webgpu, which makes TAA work but the resulting image is upside-down.
            // We could flip the image in the following pass, but ideally a better solution should be found.
            uv.y = 1.0 - uv.y;
            // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        #endif

        // current frame
        vec4 srcColor = texture2D(sourceTexture, uv);

        // current depth is in linear space, convert it to non-linear space
        float linearDepth = getLinearScreenDepth(uv0);
        float depth = delinearizeDepth(linearDepth);

        // previous frame
        vec2 historyUv = reproject(uv0, depth);

        #ifdef QUALITY_HIGH

            // high quality history, sharper result
            vec4 historyColor = SampleTextureCatmullRom(TEXTURE_PASS(historyTexture), historyUv, textureSize);

        #else

            // single sample history, more blurry result
            vec4 historyColor = texture2D(historyTexture, historyUv);

        #endif

        // handle disocclusion by clamping the history color
        vec4 historyColorClamped = colorClamp(uv, historyColor);

        // handle history buffer outside of the frame
        float mixFactor = (historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0) ?
            1.0 : 0.05;

        gl_FragColor = mix(historyColorClamped, srcColor, mixFactor);
    }
`;
