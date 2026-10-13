export default /* wgsl */`
    var lensFlareTexture: texture_2d<f32>;
    var lensFlareTextureSampler: sampler;
    uniform lensFlareIntensity: f32;

    // Global variable for debug
    var<private> dLensFlare: vec3f;

    fn applyLensFlare(color: vec3f, uv: vec2f) -> vec3f {
        dLensFlare = textureSampleLevel(lensFlareTexture, lensFlareTextureSampler, uv, 0.0).rgb * uniform.lensFlareIntensity;
        return color + dLensFlare;
    }

    // the 'lensflare' debug view, displaying the flares as they are added to the scene
    fn debugLensflare() -> vec3f {
        return dLensFlare;
    }
`;
