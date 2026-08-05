export default /* glsl */`
    #ifdef SSAO
        #define SSAO_TEXTURE
    #endif

    #if DEBUG_COMPOSE == ssao
        #define SSAO_TEXTURE
    #endif

    #ifdef SSAO_TEXTURE
        uniform sampler2D ssaoTexture;
        
        // Global variable for debug
        float dSsao;
        
        vec3 applySsao(vec3 color, vec2 uv) {
            dSsao = texture2DLod(ssaoTexture, uv, 0.0).r;
            
            #ifdef SSAO
                return color * dSsao;
            #else
                return color;
            #endif
        }
    #endif
`;
