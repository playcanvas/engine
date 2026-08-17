export default /* wgsl */`
    #include "tonemappingPS"
    #include "gammaPS"

    varying uv0: vec2f;
    var sceneTexture: texture_2d<f32>;
    var sceneTextureSampler: sampler;
    uniform sceneTextureInvRes: vec2f;
    uniform composeTargetFlipY: f32;

    #include "composeBloomPS"
    #include "composeDofPS"
    #include "composeSsaoPS"
    #include "composeGradingPS"
    #include "composeColorEnhancePS"
    #include "composeVignettePS"
    #include "composeFringingPS"
    #include "composeCasPS"
    #include "composeColorLutPS"

    // The depth debug mode displays a depth some other pass in this frame has already produced - the
    // debug modes never turn any rendering on, so the mode is switched to depthmissing when nothing
    // did, see RenderPassCompose. That is also why this is included here rather than unconditionally:
    // declaring the depth sampler in a frame with no depth to bind to it is an error.
    #if DEBUG_COMPOSE == depth
        #include "screenDepthPS"
    #endif

    #include "composeDeclarationsPS"

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {

        #include "composeMainStartPS"

        var output: FragmentOutput;

        // flip the sampling vertically when the target render target stores a flipped image, so
        // that the natively-oriented output of the scene pass chain lands in the requested row order
        var uv = vec2f(uv0.x, mix(uv0.y, 1.0 - uv0.y, uniform.composeTargetFlipY));

        let scene = textureSampleLevel(sceneTexture, sceneTextureSampler, uv, 0.0);
        var result = scene.rgb;

        // Apply CAS
        #ifdef CAS
            result = applyCas(result, uv, uniform.sharpness);
        #endif

        // Apply DOF
        #ifdef DOF
            result = applyDof(result, uv);
        #endif

        // Apply SSAO
        #ifdef SSAO_TEXTURE
            result = applySsao(result, uv);
        #endif

        // Apply Fringing
        #ifdef FRINGING
            result = applyFringing(result, uv);
        #endif

        // Apply Bloom
        #ifdef BLOOM
            result = applyBloom(result, uv);
        #endif

        // Apply Color Enhancement (shadows, highlights, vibrance)
        #ifdef COLOR_ENHANCE
            result = applyColorEnhance(result);
        #endif

        // Apply Color Grading
        #ifdef GRADING
            result = applyGrading(result);
        #endif

        // Apply Tone Mapping
        result = toneMap(max(vec3f(0.0), result));

        // Apply Color LUT after tone mapping, in LDR space
        #ifdef COLOR_LUT
            result = applyColorLUT(result);
        #endif

        // Apply Vignette
        #ifdef VIGNETTE
            result = applyVignette(result, uv);
        #endif

        #include "composeMainEndPS"

        // Debug output handling in one centralized location
        #ifdef DEBUG_COMPOSE
            #if DEBUG_COMPOSE == scene
                result = scene.rgb;
            #elif defined(BLOOM) && DEBUG_COMPOSE == bloom
                result = dBloom * uniform.bloomIntensity;
            #elif defined(DOF) && DEBUG_COMPOSE == dofcoc
                result = vec3f(dCoc, 0.0);
            #elif defined(DOF) && DEBUG_COMPOSE == dofblur
                result = dBlur;
            #elif defined(SSAO_TEXTURE) && DEBUG_COMPOSE == ssao
                result = vec3f(dSsao);
            #elif defined(VIGNETTE) && DEBUG_COMPOSE == vignette
                result = vec3f(dVignette);
            #elif DEBUG_COMPOSE == depth
                // a linear ramp over the camera clip range
                let dDepth = getLinearScreenDepth(uv);
                result = vec3f(clamp((dDepth - uniform.camera_params.z) / (uniform.camera_params.y - uniform.camera_params.z), 0.0, 1.0));
            #elif DEBUG_COMPOSE == depthmissing
                // the depth was asked for while nothing in this frame produces it
                result = vec3f(0.0);
            #endif
        #endif

        // Apply gamma correction
        result = gammaCorrectOutput(result);

        output.color = vec4f(result, scene.a);
        return output;
    }
`;
