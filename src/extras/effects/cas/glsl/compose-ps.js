// Contrast Adaptive Sharpening (CAS) is used to apply the sharpening. It's based on AMD's
// FidelityFX CAS, WebGL implementation: https://www.shadertoy.com/view/wtlSWB. It sharpens the
// rendered image itself, so it runs on the scene sample at COMPOSESLOT_SCENE, ahead of the other
// effects, which avoids a separate render pass. CAS expects LDR input, so an HDR scene is mapped to
// LDR around it (CAS_HDR).
export default /* glsl */`
    uniform float sharpness;

    // reversible LDR <-> HDR tone mapping, as CAS needs LDR input
    #ifdef CAS_HDR
        float maxComponent(float x, float y, float z) { return max(x, max(y, z)); }
        vec3 toSDR(vec3 c) { return c / (1.0 + maxComponent(c.r, c.g, c.b)); }
        vec3 toHDR(vec3 c) { return c / max(1.0 - maxComponent(c.r, c.g, c.b), 1e-4); }
    #else
        vec3 toSDR(vec3 c) { return c; }
        vec3 toHDR(vec3 c) { return c; }
    #endif

    vec4 applyCas(vec4 scene, vec2 uv) {
        float x = sceneTextureSize.z;
        float y = sceneTextureSize.w;

        // sample 4 neighbors around the already sampled pixel, and convert it to SDR
        vec3 a = toSDR(texture2DLod(sceneTexture, uv + vec2(0.0, -y), 0.0).rgb);
        vec3 b = toSDR(texture2DLod(sceneTexture, uv + vec2(-x, 0.0), 0.0).rgb);
        vec3 c = toSDR(scene.rgb);
        vec3 d = toSDR(texture2DLod(sceneTexture, uv + vec2(x, 0.0), 0.0).rgb);
        vec3 e = toSDR(texture2DLod(sceneTexture, uv + vec2(0.0, y), 0.0).rgb);

        // apply the sharpening
        float min_g = min(a.g, min(b.g, min(c.g, min(d.g, e.g))));
        float max_g = max(a.g, max(b.g, max(c.g, max(d.g, e.g))));
        float sharpening_amount = sqrt(min(1.0 - max_g, min_g) / max(max_g, 1e-4));
        float w = sharpening_amount * sharpness;
        vec3 res = (w * (a + b + d + e) + c) / (4.0 * w + 1.0);

        // remove negative colors
        res = max(res, 0.0);

        // convert back to HDR, keeping the scene alpha
        return vec4(toHDR(res), scene.a);
    }
`;
