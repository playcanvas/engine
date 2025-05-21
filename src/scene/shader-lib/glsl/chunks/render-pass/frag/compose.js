// Contrast Adaptive Sharpening (CAS) is used to apply the sharpening. It's based on AMD's
// FidelityFX CAS, WebGL implementation: https://www.shadertoy.com/view/wtlSWB. It's best to run it
// on a tone-mapped color buffer after post-processing, but before the UI, and so this is the
// obvious place to put it to avoid a separate render pass, even though we need to handle running it
// before the tone-mapping.
export default /* glsl */`
    #include "tonemappingPS"
    #include "gammaPS"

    varying vec2 uv0;
    uniform sampler2D sceneTexture;
    uniform vec2 sceneTextureInvRes;

    #ifdef BLOOM
        uniform sampler2D bloomTexture;
        uniform float bloomIntensity;
    #endif

    #ifdef DOF
        uniform sampler2D cocTexture;
        uniform sampler2D blurTexture;

        // Samples the DOF blur and CoC textures. When the blur texture was generated at lower resolution,
        // upscale it to the full resolution using bilinear interpolation to hide the blockiness along COC edges.
        vec3 dofBlur(vec2 uv, out vec2 coc) {
            coc = texture2DLod(cocTexture, uv, 0.0).rg;

            #if DOF_UPSCALE
                vec2 blurTexelSize = 1.0 / vec2(textureSize(blurTexture, 0));
                vec3 bilinearBlur = vec3(0.0);
                float totalWeight = 0.0;

                // 3x3 grid of neighboring texels
                for (int i = -1; i <= 1; i++) {
                    for (int j = -1; j <= 1; j++) {
                        vec2 offset = vec2(i, j) * blurTexelSize;
                        vec2 cocSample = texture2DLod(cocTexture, uv + offset, 0.0).rg;
                        vec3 blurSample = texture2DLod(blurTexture, uv + offset, 0.0).rgb;

                        // Accumulate the weighted blur sample
                        float cocWeight = clamp(cocSample.r + cocSample.g, 0.0, 1.0);
                        bilinearBlur += blurSample * cocWeight;
                        totalWeight += cocWeight;
                    }
                }

                // normalize the accumulated color
                if (totalWeight > 0.0) {
                    bilinearBlur /= totalWeight;
                }

                return bilinearBlur;
            #else
                // when blurTexture is full resolution, just sample it, no upsampling
                return texture2DLod(blurTexture, uv, 0.0).rgb;
            #endif
        }

    #endif

    #ifdef SSAO
        #define SSAO_TEXTURE
    #endif

    #if DEBUG_COMPOSE == ssao
        #define SSAO_TEXTURE
    #endif

    #ifdef SSAO_TEXTURE
        uniform sampler2D ssaoTexture;
    #endif

    #ifdef GRADING
        uniform vec3 brightnessContrastSaturation;
        uniform vec3 tint;

        // for all parameters, 1.0 is the no-change value
        vec3 colorGradingHDR(vec3 color, float brt, float sat, float con)
        {
            // tint
            color *= tint;

            // brightness
            color = color * brt;

            // saturation
            float grey = dot(color, vec3(0.3, 0.59, 0.11));
            grey = grey / max(1.0, max(color.r, max(color.g, color.b)));    // Normalize luminance in HDR to preserve intensity (optional)
            color = mix(vec3(grey), color, sat);

            // contrast
            return mix(vec3(0.5), color, con);
        }
    
    #endif

    #ifdef VIGNETTE

        uniform vec4 vignetterParams;

        float vignette(vec2 uv) {

            float inner = vignetterParams.x;
            float outer = vignetterParams.y;
            float curvature = vignetterParams.z;
            float intensity = vignetterParams.w;

            // edge curvature
            vec2 curve = pow(abs(uv * 2.0 -1.0), vec2(1.0 / curvature));

            // distance to edge
            float edge = pow(length(curve), curvature);

            // gradient and intensity
            return 1.0 - intensity * smoothstep(inner, outer, edge);
        }        

    #endif

    #ifdef FRINGING

        uniform float fringingIntensity;

        vec3 fringing(vec2 uv, vec3 color) {

            // offset depends on the direction from the center, raised to power to make it stronger away from the center
            vec2 centerDistance = uv - 0.5;
            vec2 offset = fringingIntensity * pow(centerDistance, vec2(2.0, 2.0));

            color.r = texture2D(sceneTexture, uv - offset).r;
            color.b = texture2D(sceneTexture, uv + offset).b;
            return color;
        }

    #endif

    #ifdef CAS

        uniform float sharpness;

        // reversible LDR <-> HDR tone mapping, as CAS needs LDR input
        // based on: https://gpuopen.com/learn/optimized-reversible-tonemapper-for-resolve/
        float maxComponent(float x, float y, float z) { return max(x, max(y, z)); }
        vec3 toSDR(vec3 c) { return c / (1.0 + maxComponent(c.r, c.g, c.b)); }
        vec3 toHDR(vec3 c) { return c / (1.0 - maxComponent(c.r, c.g, c.b)); }

        vec3 cas(vec3 color, vec2 uv, float sharpness) {

            float x = sceneTextureInvRes.x;
            float y = sceneTextureInvRes.y;

            // sample 4 neighbors around the already sampled pixel, and convert it to SDR
            vec3 a = toSDR(texture2DLod(sceneTexture, uv + vec2(0.0, -y), 0.0).rgb);
            vec3 b = toSDR(texture2DLod(sceneTexture, uv + vec2(-x, 0.0), 0.0).rgb);
            vec3 c = toSDR(color.rgb);
            vec3 d = toSDR(texture2DLod(sceneTexture, uv + vec2(x, 0.0), 0.0).rgb);
            vec3 e = toSDR(texture2DLod(sceneTexture, uv + vec2(0.0, y), 0.0).rgb);

            // apply the sharpening
            float min_g = min(a.g, min(b.g, min(c.g, min(d.g, e.g))));
            float max_g = max(a.g, max(b.g, max(c.g, max(d.g, e.g))));
            float sharpening_amount = sqrt(min(1.0 - max_g, min_g) / max_g);
            float w = sharpening_amount * sharpness;
            vec3 res = (w * (a + b + d + e) + c) / (4.0 * w + 1.0);

            // remove negative colors
            res = max(res, 0.0);

            // convert back to HDR
            return toHDR(res);
        }

    #endif

    void main() {

        vec2 uv = uv0;

        // TAA pass renders upside-down on WebGPU, flip it here
        #ifdef TAA
        #ifdef WEBGPU
            uv.y = 1.0 - uv.y;
        #endif
        #endif

        vec4 scene = texture2DLod(sceneTexture, uv, 0.0);
        vec3 result = scene.rgb;

        #ifdef CAS
            result = cas(result, uv, sharpness);
        #endif

        #ifdef DOF
            vec2 coc;
            vec3 blur = dofBlur(uv0, coc);
            result = mix(result, blur, coc.r + coc.g);
        #endif

        #ifdef SSAO_TEXTURE
            mediump float ssao = texture2DLod(ssaoTexture, uv0, 0.0).r;
        #endif

        #ifdef SSAO
            result *= ssao;
        #endif

        #ifdef FRINGING
            result = fringing(uv, result);
        #endif

        #ifdef BLOOM
            vec3 bloom = texture2DLod(bloomTexture, uv0, 0.0).rgb;
            result += bloom * bloomIntensity;
        #endif

        #ifdef GRADING
            // color grading takes place in HDR space before tone mapping
            result = colorGradingHDR(result, brightnessContrastSaturation.x, brightnessContrastSaturation.z, brightnessContrastSaturation.y);
        #endif

        result = toneMap(result);

        #ifdef VIGNETTE
            mediump float vig = vignette(uv);
            result *= vig;
        #endif

        // debug output
        #ifdef DEBUG_COMPOSE

            #ifdef BLOOM
                #if DEBUG_COMPOSE == bloom
                    result = bloom * bloomIntensity;
                #endif
            #endif

            #ifdef DOF
                #ifdef DEBUG_COMPOSE == dofcoc
                    result = vec3(coc, 0.0);
                #endif
                #ifdef DEBUG_COMPOSE == dofblur
                    result = blur;
                #endif
            #endif

            #if DEBUG_COMPOSE == ssao
                result = vec3(ssao);
            #endif

            #if DEBUG_COMPOSE == vignette
                result = vec3(vig);
            #endif

            #if DEBUG_COMPOSE == scene
                result = scene.rgb;
            #endif

        #endif

        result = gammaCorrectOutput(result);

        gl_FragColor = vec4(result, scene.a);
    }
`;
