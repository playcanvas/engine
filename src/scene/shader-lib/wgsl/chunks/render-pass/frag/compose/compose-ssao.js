export default /* wgsl */`
    #ifdef SSAO
        #define SSAO_TEXTURE
    #endif

    #if DEBUG_COMPOSE == ssao
        #define SSAO_TEXTURE
    #endif

    #ifdef SSAO_TEXTURE
        var ssaoTexture: texture_2d<f32>;
        var ssaoTextureSampler: sampler;
        
        // Global variable for debug
        var<private> dSsao: f32;
        
        fn applySsao(color: vec3f, uv: vec2f) -> vec3f {
            dSsao = textureSampleLevel(ssaoTexture, ssaoTextureSampler, uv, 0.0).r;
            
            #ifdef SSAO
                return color * dSsao;
            #else
                return color;
            #endif
        }
    #endif
`;
