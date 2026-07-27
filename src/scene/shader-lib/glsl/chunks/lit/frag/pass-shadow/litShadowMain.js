// main shader entry point for the lit material for shadow rendering
export default /* glsl */`

#if LIGHT_TYPE != DIRECTIONAL
    uniform vec3 view_position;
    uniform float light_radius;
#endif

#if SHADOW_TYPE == PCSS_32F
    #include "linearizeDepthPS"
#endif

void main(void) {

    // protect against rasterization of degenerate triangles of animated meshes, which can generate
    // out of range / NaN depth - VSM blur would smear those into large visible artifacts
    if (!(gl_FragCoord.z >= 0.0 && gl_FragCoord.z <= 1.0)) discard;

    #include "litUserMainStartPS"

    evaluateFrontend();

    // using non-standard depth, i.e gl_FragCoord.z
    #ifdef PERSPECTIVE_DEPTH
        float depth = gl_FragCoord.z;

        #if SHADOW_TYPE == PCSS_32F
            // spot/omni shadows currently use linear depth.
            // TODO: use perspective depth for spot/omni the same way as directional
            #if LIGHT_TYPE != DIRECTIONAL
                depth = linearizeDepthWithParams(depth, camera_params);
            #endif
        #endif

    #else
        float depth = min(distance(view_position, vPositionW) / light_radius, 0.99999);
        #define MODIFIED_DEPTH
    #endif

    #if SHADOW_TYPE == VSM_16F || SHADOW_TYPE == VSM_32F

        float warpD = 2.0 * depth - 1.0;

        #if SHADOW_TYPE == VSM_32F

            // EVSM4 - a positive and a negative exponential warp, each with its second moment.
            // Note: these exponents must match those used by the shadowEVSM chunk.
            float warpPos = exp(15.0 * warpD);
            float warpNeg = exp(-5.0 * warpD);
            gl_FragColor = vec4(warpPos, warpPos * warpPos, -warpNeg, warpNeg * warpNeg);

        #else

            // EVSM2 - a single exponential warp with its second moment, z stores the coverage
            float warpPos = exp(5.54 * warpD);
            gl_FragColor = vec4(warpPos, warpPos * warpPos, 1.0, 1.0);

        #endif
    #else
        #if SHADOW_TYPE == PCSS_32F
            // store depth into R32
            gl_FragColor.r = depth;
        #else
            #ifdef MODIFIED_DEPTH
                // If we end up using modified depth, it needs to be explicitly written to gl_FragDepth
                gl_FragDepth = depth;
            #endif

            // just the simplest code, color is not written anyway
            gl_FragColor = vec4(1.0);
        #endif
    #endif

    #include "litUserMainEndPS"
}
`;
