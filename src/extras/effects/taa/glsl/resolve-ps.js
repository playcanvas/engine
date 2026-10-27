export default /* glsl */`
    #include  "sampleCatmullRomPS"
    #include  "reversibleTonemapPS"
    #include  "screenDepthPS"

    uniform sampler2D sourceTexture;
    uniform sampler2D historyTexture;
    uniform mat4 matrix_viewProjectionPrevious;
    uniform mat4 matrix_viewProjectionInverse;
    uniform float taaExposure;   // the exposure the scene is displayed with
    uniform vec4 jitters;   // xy: current frame, zw: previous frame
    uniform vec2 textureSize;
    uniform vec2 historySize;

    varying vec2 uv0;

    // the most of the current frame taken while the camera moves the surface of a pixel across the
    // screen, and the motion from which it is taken, in pixels of the history
    const float TAA_MOTION_BLEND = 0.5;
    const float TAA_MOTION_PIXELS = 32.0;

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

        // remove the jitter of the previous frame, as the history holds the image without it
        return (screenPrevious.xy / screenPrevious.w + jitters.zw) * 0.5 + 0.5;
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

    #ifdef TAA_UPSCALE

        // The current frame renders at a lower resolution than the history. Each of its texels holds
        // the image at its center moved by the jitter of the frame, so from frame to frame its sample
        // lands at a different position within the pixels of the history. The current color at this
        // pixel is reconstructed from the texels around it, weighted by how close their samples are
        // to it, and the weight of the nearest decides how much of it the history takes - over the
        // jitter sequence, each pixel of the history accumulates the samples landing on it.
        vec4 upscaleCurrent(vec2 uv, out float weight, out vec3 minPremul, out vec3 maxPremul) {

            // this pixel and the jitter, in texels of the current frame
            vec2 position = uv * textureSize;
            vec2 jitter = jitters.xy * 0.5 * textureSize;

            // the texel whose sample is nearest to this pixel
            vec2 nearest = floor(position - jitter);

            // pixels of the history per texel of the current frame
            float scale = historySize.x / textureSize.x;

            vec4 sum = vec4(0.0);
            float sumWeight = 0.0;
            vec4 nearestColor = vec4(0.0);
            weight = 0.0;
            minPremul = vec3(9999.0);
            maxPremul = vec3(-9999.0);
            for (float x = -1.0; x <= 1.0; ++x) {
                for (float y = -1.0; y <= 1.0; ++y) {
                    vec2 texel = nearest + vec2(x, y);
                    vec4 s = texture2DLod(sourceTexture, (texel + 0.5) / textureSize, 0.0);
                    vec3 premul = s.rgb * s.a;
                    minPremul = min(minPremul, premul);
                    maxPremul = max(maxPremul, premul);
                    if (x == 0.0 && y == 0.0) {
                        nearestColor = s;
                    }

                    // the distance of its sample to this pixel, in pixels of the history
                    vec2 d = (texel + 0.5 + jitter - position) * scale;
                    float w = exp(-2.29 * dot(d, d));
                    sum += s * w;
                    sumWeight += w;
                    weight = max(weight, w);
                }
            }
            return sumWeight > 1e-4 ? sum / sumWeight : nearestColor;
        }

    #endif

    void main()
    {
        // current frame
        #ifdef TAA_UPSCALE
            float currentWeight;
            vec3 minPremul;
            vec3 maxPremul;
            vec4 srcColor = upscaleCurrent(uv0, currentWeight, minPremul, maxPremul);
        #else
            vec4 srcColor = texture2D(sourceTexture, uv0);
        #endif

        // current depth is in linear space, convert it to non-linear space
        float linearDepth = getLinearScreenDepth(uv0);
        float depth = delinearizeDepth(linearDepth);

        // previous frame
        vec2 historyUv = reproject(uv0, depth);

        #ifdef QUALITY_HIGH

            vec4 historySample = SampleTextureCatmullRom(TEXTURE_PASS(historyTexture), historyUv, historySize);

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

        #ifdef TAA_UPSCALE
            // clamped to the range of the texels around this pixel, and taking more of the current
            // frame the closer its nearest sample is to this pixel
            vec3 historyPremulClamped = clamp(historyPremul, minPremul, maxPremul);
            float blend = 0.1 * currentWeight;
        #else
            vec3 historyPremulClamped = colorClampPremul(uv0, historyPremul);
            float blend = 0.05;
        #endif

        // The further the history of this pixel was reprojected from, the faster the camera moves its
        // surface across the screen: the history has been resampled further, which blurs it, and it is
        // more likely not to hold this surface at all. The current frame is then taken more of, up to
        // TAA_MOTION_BLEND from a motion of TAA_MOTION_PIXELS pixels of the history - while the camera
        // is still, the history accumulates as before.
        float motion = length((uv0 - historyUv) * historySize);
        blend = mix(blend, max(blend, TAA_MOTION_BLEND), clamp(motion / TAA_MOTION_PIXELS, 0.0, 1.0));

        float mixFactor = (historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0) ?
            1.0 : blend;

        // The history and the current frame are blended compressed by a reversible tone mapping of
        // their exposed values. Blended in linear HDR, the samples of a bright surface partially
        // covering a pixel dominate its average, which the tone mapping then displays nearly as
        // bright as the surface - the edges of bright geometry would stay thick and aliased.
        float e = max(taaExposure, 1e-6);
        vec3 mixedPremul = reversibleTonemapInverse(mix(reversibleTonemap(historyPremulClamped * e), reversibleTonemap(srcPremul * e), mixFactor)) / e;
        float a = srcColor.a;
        // Match UNORM8 alpha quantum: below one step, un-premul is ill-defined / noisy; use current RGB.
        const float UNPREMUL_EPS = 1.0 / 255.0;
        vec3 rgbStraight = (a > UNPREMUL_EPS) ? (mixedPremul / a) : srcColor.rgb;
        gl_FragColor = vec4(rgbStraight, a);
    }
`;
