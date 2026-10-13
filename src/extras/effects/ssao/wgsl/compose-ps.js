export default /* wgsl */`
    var ssaoTexture: texture_2d<f32>;
    var ssaoTextureSampler: sampler;

    // Global variable for debug
    var<private> dSsao: f32;

    fn applySsao(color: vec3f, uv: vec2f) -> vec3f {

        // in the lighting mode the lit shaders apply the occlusion as the scene renders, and it is
        // sampled here for the debug view only
        #ifdef SSAO_LIGHTING
            #if DEBUG_COMPOSE == ssao
                dSsao = textureSampleLevel(ssaoTexture, ssaoTextureSampler, uv, 0.0).r;
            #endif
            return color;
        #else
            dSsao = textureSampleLevel(ssaoTexture, ssaoTextureSampler, uv, 0.0).r;
            return color * dSsao;
        #endif
    }

    // the 'ssao' debug view, displaying the occlusion
    fn debugSsao() -> vec3f {
        return vec3f(dSsao);
    }
`;
