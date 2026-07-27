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

    // protect against rasterization of degenerate triangles of animated meshes, which can generate
    // out of range / NaN depth - VSM blur would smear those into large visible artifacts
    if (!(input.position.z >= 0.0 && input.position.z <= 1.0)) {
        discard;
    }

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

        let warpD: f32 = 2.0 * depth - 1.0;

        #if SHADOW_TYPE == VSM_32F

            // EVSM4 - a positive and a negative exponential warp, each with its second moment.
            // Note: these exponents must match those used by the shadowEVSM chunk.
            let warpPos: f32 = exp(15.0 * warpD);
            let warpNeg: f32 = exp(-5.0 * warpD);
            output.color = vec4f(warpPos, warpPos * warpPos, -warpNeg, warpNeg * warpNeg);

        #else

            // EVSM2 - a single exponential warp with its second moment, z stores the coverage
            let warpPos: f32 = exp(5.54 * warpD);
            output.color = vec4f(warpPos, warpPos * warpPos, 1.0, 1.0);

        #endif
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
