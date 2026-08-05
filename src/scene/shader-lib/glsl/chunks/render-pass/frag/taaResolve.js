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
        depth = depth * 2.0 - 1.0;
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

    vec3 colorClampPremul(vec2 uv, vec3 historyPremul) {

        vec3 minPremul = vec3(9999.0);
        vec3 maxPremul = vec3(-9999.0);

        // 3x3 neighborhood in premultiplied space — same domain as the temporal mix (see main()).
        for(float x = -1.0; x <= 1.0; ++x) {
            for(float y = -1.0; y <= 1.0; ++y) {
                vec4 s = texture2D(sourceTexture, uv + vec2(x, y) / textureSize);
                vec3 premul = s.rgb * s.a;
                minPremul = min(minPremul, premul);
                maxPremul = max(maxPremul, premul);
            }
        }

        return clamp(historyPremul, minPremul, maxPremul);
    }

    void main()
    {
        // current frame
        vec4 srcColor = texture2D(sourceTexture, uv0);

        // current depth is in linear space, convert it to non-linear space
        float linearDepth = getLinearScreenDepth(uv0);
        float depth = delinearizeDepth(linearDepth);

        // previous frame
        vec2 historyUv = reproject(uv0, depth);

        #ifdef QUALITY_HIGH

            vec4 historySample = SampleTextureCatmullRom(TEXTURE_PASS(historyTexture), historyUv, textureSize);

        #else

            vec4 historySample = texture2D(historyTexture, historyUv);

        #endif

        // Premultiplied (rgb * a) is the coverage-correct space for TAA: straight RGB interpolates
        // uncorrelated color and opacity at edges, which causes colored fringes and alpha-related
        // ghosting when history is blended or clamped against a 3x3 neighborhood. We clamp and mix
        // in premultiplied space, then un-premultiply once using the current frame's alpha only
        // (alpha is not temporally filtered — output stays tied to this frame's coverage).
        vec3 historyPremul = historySample.rgb * historySample.a;
        vec3 srcPremul = srcColor.rgb * srcColor.a;

        vec3 historyPremulClamped = colorClampPremul(uv0, historyPremul);

        float mixFactor = (historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0) ?
            1.0 : 0.05;

        vec3 mixedPremul = mix(historyPremulClamped, srcPremul, mixFactor);
        float a = srcColor.a;
        // Match UNORM8 alpha quantum: below one step, un-premul is ill-defined / noisy; use current RGB.
        const float UNPREMUL_EPS = 1.0 / 255.0;
        vec3 rgbStraight = (a > UNPREMUL_EPS) ? (mixedPremul / a) : srcColor.rgb;
        gl_FragColor = vec4(rgbStraight, a);
    }
`;
