// Contrast Adaptive Sharpening (CAS) is used to apply the sharpening. It's based on AMD's
// FidelityFX CAS, WebGL implementation: https://www.shadertoy.com/view/wtlSWB. It's best to run it
// on a tone-mapped color buffer after post-processing, but before the UI, and so this is the
// obvious place to put it to avoid a separate render pass, even though we need to handle running it
// before the tone-mapping.
export default /* glsl */`
    #ifdef CAS
        uniform float sharpness;

        // reversible LDR <-> HDR tone mapping, as CAS needs LDR input
        float maxComponent(float x, float y, float z) { return max(x, max(y, z)); }
        vec3 toSDR(vec3 c) { return c / (1.0 + maxComponent(c.r, c.g, c.b)); }
        vec3 toHDR(vec3 c) { return c / (1.0 - maxComponent(c.r, c.g, c.b)); }

        vec3 applyCas(vec3 color, vec2 uv, float sharpness) {
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
`;
