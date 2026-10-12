export default /* wgsl */`
    var bloomTexture: texture_2d<f32>;
    var bloomTextureSampler: sampler;
    uniform bloomIntensity: f32;

    // Global variable for debug
    var<private> dBloom: vec3f;

    fn applyBloom(color: vec3f, uv: vec2f) -> vec3f {
        dBloom = textureSampleLevel(bloomTexture, bloomTextureSampler, uv, 0.0).rgb;
        return color + dBloom * uniform.bloomIntensity;
    }

    // the 'bloom' debug view, displaying the bloom as it is added to the scene
    fn debugBloom() -> vec3f {
        return dBloom * uniform.bloomIntensity;
    }
`;
