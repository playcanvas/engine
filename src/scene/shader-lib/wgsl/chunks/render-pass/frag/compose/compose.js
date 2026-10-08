export default /* wgsl */`
    #include "tonemappingPS"
    #include "gammaPS"

    varying uv0: vec2f;
    var sceneTexture: texture_2d<f32>;
    var sceneTextureSampler: sampler;
    // the size of the scene texture: width, height, 1 / width, 1 / height
    uniform sceneTextureSize: vec4f;
    uniform composeTargetFlipY: f32;

    #include "composeDofPS"

    // The depth debug mode displays a depth some other pass in this frame has already produced - the
    // debug modes never turn any rendering on, so the mode is switched to depthmissing when nothing
    // did, see RenderPassCompose. That is also why this is included here rather than unconditionally:
    // declaring the depth sampler in a frame with no depth to bind to it is an error.
    #if DEBUG_COMPOSE == depth
        #include "screenDepthPS"
    #endif

    // declarations of the effects registered with the CameraFrame, assembled by RenderPassCompose
    #include "composeEffectDeclarationsPS"

    #include "composeDeclarationsPS"

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {

        #include "composeMainStartPS"

        var output: FragmentOutput;

        // flip the sampling vertically when the target render target stores a flipped image, so
        // that the natively-oriented output of the scene pass chain lands in the requested row order
        var uv = vec2f(uv0.x, mix(uv0.y, 1.0 - uv0.y, uniform.composeTargetFlipY));

        var scene = textureSampleLevel(sceneTexture, sceneTextureSampler, uv, 0.0);

        // COMPOSESLOT_SCENE effects - operate on the sampled scene colour including its alpha
        #include "composeSlotSceneCallPS, COMPOSE_SCENE_COUNT"

        var result = scene.rgb;

        // Apply DOF
        #ifdef DOF
            result = applyDof(result, uv);
        #endif

        // COMPOSESLOT_HDR effects - linear, scene-referred colour
        #include "composeSlotHdrCallPS, COMPOSE_HDR_COUNT"

        // Apply Tone Mapping
        result = toneMap(max(vec3f(0.0), result));

        // COMPOSESLOT_LDR effects - display-referred colour, before gamma correction
        #include "composeSlotLdrCallPS, COMPOSE_LDR_COUNT"

        #include "composeMainEndPS"

        // Debug output handling in one centralized location
        #ifdef DEBUG_COMPOSE
            #if DEBUG_COMPOSE == scene
                // the scene texture itself, before any effect, those at COMPOSESLOT_SCENE included
                result = textureSampleLevel(sceneTexture, sceneTextureSampler, uv, 0.0).rgb;
            #elif defined(DOF) && DEBUG_COMPOSE == dofcoc
                result = vec3f(dCoc, 0.0);
            #elif defined(DOF) && DEBUG_COMPOSE == dofblur
                result = dBlur;
            #elif DEBUG_COMPOSE == depth
                // a linear ramp over the camera clip range
                let dDepth = getLinearScreenDepth(uv);
                result = vec3f(clamp((dDepth - uniform.camera_params.z) / (uniform.camera_params.y - uniform.camera_params.z), 0.0, 1.0));
            #elif DEBUG_COMPOSE == depthmissing
                // the depth was asked for while nothing in this frame produces it
                result = vec3f(0.0);
            #endif

            // the debug view of the registered effect providing the active one, selected by
            // RenderPassCompose through the COMPOSE_EFFECT_DEBUG define
            #include "composeEffectDebugPS"
        #endif

        // Apply gamma correction
        result = gammaCorrectOutput(result);

        // COMPOSESLOT_OUTPUT effects - final output values, after gamma correction
        #include "composeSlotOutputCallPS, COMPOSE_OUTPUT_COUNT"

        output.color = vec4f(result, scene.a);
        return output;
    }
`;
