export default /* glsl */`
    uniform sampler2D ssaoTexture;

    // Global variable for debug
    float dSsao;

    vec3 applySsao(vec3 color, vec2 uv) {

        // in the lighting mode the lit shaders apply the occlusion as the scene renders, and it is
        // sampled here for the debug view only
        #ifdef SSAO_LIGHTING
            #if DEBUG_COMPOSE == ssao
                dSsao = texture2DLod(ssaoTexture, uv, 0.0).r;
            #endif
            return color;
        #else
            dSsao = texture2DLod(ssaoTexture, uv, 0.0).r;
            return color * dSsao;
        #endif
    }

    // the 'ssao' debug view, displaying the occlusion
    vec3 debugSsao() {
        return vec3(dSsao);
    }
`;
