export default /* glsl */`
    #include "tonemappingPS"
    #include "gammaPS"

    varying vec2 uv0;
    uniform sampler2D sceneTexture;
    uniform vec2 sceneTextureInvRes;

    #include "composeBloomPS"
    #include "composeDofPS"
    #include "composeSsaoPS"
    #include "composeGradingPS"
    #include "composeVignettePS"
    #include "composeFringingPS"
    #include "composeCasPS"

    void main() {
        vec2 uv = uv0;

        // TAA pass renders upside-down on WebGPU, flip it here
        #ifdef TAA
        #ifdef WEBGPU
            uv.y = 1.0 - uv.y;
        #endif
        #endif

        vec4 scene = texture2DLod(sceneTexture, uv, 0.0);
        vec3 result = scene.rgb;

        // Apply CAS
        #ifdef CAS
            result = applyCas(result, uv, sharpness);
        #endif

        // Apply DOF
        #ifdef DOF
            result = applyDof(result, uv0);
        #endif

        // Apply SSAO
        #ifdef SSAO_TEXTURE
            result = applySsao(result, uv0);
        #endif

        // Apply Fringing
        #ifdef FRINGING
            result = applyFringing(result, uv);
        #endif

        // Apply Bloom
        #ifdef BLOOM
            result = applyBloom(result, uv0);
        #endif

        // Apply Color Grading
        #ifdef GRADING
            result = applyGrading(result);
        #endif

        // Apply Tone Mapping
        result = toneMap(result);

        // Apply Vignette
        #ifdef VIGNETTE
            result = applyVignette(result, uv);
        #endif

        // Debug output handling in one centralized location
        #ifdef DEBUG_COMPOSE
            #if DEBUG_COMPOSE == scene
                result = scene.rgb;
            #elif defined(BLOOM) && DEBUG_COMPOSE == bloom
                result = dBloom * bloomIntensity;
            #elif defined(DOF) && DEBUG_COMPOSE == dofcoc
                result = vec3(dCoc, 0.0);
            #elif defined(DOF) && DEBUG_COMPOSE == dofblur
                result = dBlur;
            #elif defined(SSAO_TEXTURE) && DEBUG_COMPOSE == ssao
                result = vec3(dSsao);
            #elif defined(VIGNETTE) && DEBUG_COMPOSE == vignette
                result = vec3(dVignette);
            #endif
        #endif

        // Apply gamma correction
        result = gammaCorrectOutput(result);

        gl_FragColor = vec4(result, scene.a);
    }
`;
