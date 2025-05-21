// main shader entry point for the lit material for shadow rendering
export default /* wgsl */`

#if LIGHT_TYPE != DIRECTIONAL
    uniform view_position: vec3f;
    uniform light_radius: f32;
#endif

#if SHADOW_TYPE == PCSS_32F
    #include "linearizeDepthPS"
#endif

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {

    #include "litUserMainStartPS"

    var output: FragmentOutput;

    evaluateFrontend();

    // using non-standard depth, i.e gl_FragCoord.z
    #ifdef PERSPECTIVE_DEPTH
        var depth: f32 = input.position.z;

        #if SHADOW_TYPE == PCSS_32F
            // spot/omni shadows currently use linear depth.
            // TODO: use perspective depth for spot/omni the same way as directional
            #if LIGHT_TYPE != DIRECTIONAL
                depth = linearizeDepthWithParams(depth, camera_params);
            #endif
        #endif

    #else
        var depth: f32 = min(distance(uniform.view_position, input.vPositionW) / uniform.light_radius, 0.99999);
        #define MODIFIED_DEPTH
    #endif

    #if SHADOW_TYPE == VSM_16F || SHADOW_TYPE == VSM_32F
        #if SHADOW_TYPE == VSM_32F
            var exponent: f32 = 15.0;
        #else
            var exponent: f32 = 5.54;
        #endif

        var depth_vsm = 2.0 * depth - 1.0;
        depth_vsm = exp(exponent * depth_vsm);
        output.color = vec4f(depth_vsm, depth_vsm * depth_vsm, 1.0, 1.0);
    #else
        #if SHADOW_TYPE == PCSS_32F
            output.color = vec4f(depth, 0.0, 0.0, 1.0);
        #else
            #ifdef MODIFIED_DEPTH
                // If we end up using modified depth, it needs to be explicitly written to gl_FragDepth
                output.fragDepth = depth;
            #endif

            // just the simplest code, color is not written anyway
            output.color = vec4f(1.0);
        #endif
    #endif

    #include "litUserMainEndPS"
    
    return output;
}
`;
