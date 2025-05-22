// Contrast Adaptive Sharpening (CAS) is used to apply the sharpening. It's based on AMD's
// FidelityFX CAS, WebGL implementation: https://www.shadertoy.com/view/wtlSWB. It's best to run it
// on a tone-mapped color buffer after post-processing, but before the UI, and so this is the
// obvious place to put it to avoid a separate render pass, even though we need to handle running it
// before the tone-mapping.
export default /* wgsl */`
    #ifdef CAS
        uniform sharpness: f32;

        // reversible LDR <-> HDR tone mapping, as CAS needs LDR input
        fn maxComponent(x: f32, y: f32, z: f32) -> f32 { return max(x, max(y, z)); }
        fn toSDR(c: vec3f) -> vec3f { return c / (1.0 + maxComponent(c.r, c.g, c.b)); }
        fn toHDR(c: vec3f) -> vec3f { return c / (1.0 - maxComponent(c.r, c.g, c.b)); }

        fn applyCas(color: vec3f, uv: vec2f, sharpness: f32) -> vec3f {
            let x = uniform.sceneTextureInvRes.x;
            let y = uniform.sceneTextureInvRes.y;

            // sample 4 neighbors around the already sampled pixel, and convert it to SDR
            let a = toSDR(textureSampleLevel(sceneTexture, sceneTextureSampler, uv + vec2f(0.0, -y), 0.0).rgb);
            let b = toSDR(textureSampleLevel(sceneTexture, sceneTextureSampler, uv + vec2f(-x, 0.0), 0.0).rgb);
            let c = toSDR(color.rgb);
            let d = toSDR(textureSampleLevel(sceneTexture, sceneTextureSampler, uv + vec2f(x, 0.0), 0.0).rgb);
            let e = toSDR(textureSampleLevel(sceneTexture, sceneTextureSampler, uv + vec2f(0.0, y), 0.0).rgb);

            // apply the sharpening
            let min_g = min(a.g, min(b.g, min(c.g, min(d.g, e.g))));
            let max_g = max(a.g, max(b.g, max(c.g, max(d.g, e.g))));
            let sharpening_amount = sqrt(min(1.0 - max_g, min_g) / max_g);
            let w = sharpening_amount * uniform.sharpness;
            var res = (w * (a + b + d + e) + c) / (4.0 * w + 1.0);

            // remove negative colors
            res = max(res, vec3f(0.0));

            // convert back to HDR
            return toHDR(res);
        }
    #endif
`;
