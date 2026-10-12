// Contrast Adaptive Sharpening (CAS) is used to apply the sharpening. It's based on AMD's
// FidelityFX CAS, WebGL implementation: https://www.shadertoy.com/view/wtlSWB. It sharpens the
// rendered image itself, so it runs on the scene sample at COMPOSESLOT_SCENE, ahead of the other
// effects, which avoids a separate render pass. CAS expects LDR input, so an HDR scene is mapped to
// LDR around it (CAS_HDR).
export default /* wgsl */`
    uniform sharpness: f32;

    // reversible LDR <-> HDR tone mapping, as CAS needs LDR input
    #ifdef CAS_HDR
        fn maxComponent(x: f32, y: f32, z: f32) -> f32 { return max(x, max(y, z)); }
        fn toSDR(c: vec3f) -> vec3f { return c / (1.0 + maxComponent(c.r, c.g, c.b)); }
        fn toHDR(c: vec3f) -> vec3f { return c / max(1.0 - maxComponent(c.r, c.g, c.b), 1e-4); }
    #else
        fn toSDR(c: vec3f) -> vec3f { return c; }
        fn toHDR(c: vec3f) -> vec3f { return c; }
    #endif

    fn applyCas(scene: vec4f, uv: vec2f) -> vec4f {
        let x = uniform.sceneTextureSize.z;
        let y = uniform.sceneTextureSize.w;

        // sample 4 neighbors around the already sampled pixel, and convert it to SDR
        let a: half3 = half3(toSDR(textureSampleLevel(sceneTexture, sceneTextureSampler, uv + vec2f(0.0, -y), 0.0).rgb));
        let b: half3 = half3(toSDR(textureSampleLevel(sceneTexture, sceneTextureSampler, uv + vec2f(-x, 0.0), 0.0).rgb));
        let c: half3 = half3(toSDR(scene.rgb));
        let d: half3 = half3(toSDR(textureSampleLevel(sceneTexture, sceneTextureSampler, uv + vec2f(x, 0.0), 0.0).rgb));
        let e: half3 = half3(toSDR(textureSampleLevel(sceneTexture, sceneTextureSampler, uv + vec2f(0.0, y), 0.0).rgb));

        // apply the sharpening
        let min_g = min(a.g, min(b.g, min(c.g, min(d.g, e.g))));
        let max_g = max(a.g, max(b.g, max(c.g, max(d.g, e.g))));
        let sharpening_amount = sqrt(min(half(1.0) - max_g, min_g) / max(max_g, half(1e-4)));
        let w = sharpening_amount * half(uniform.sharpness);
        var res = (w * (a + b + d + e) + c) / (half(4.0) * w + half(1.0));

        // remove negative colors
        res = max(res, half3(0.0));

        // convert back to HDR, keeping the scene alpha
        return vec4f(toHDR(vec3f(res)), scene.a);
    }
`;
