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
        #if SHADOW_TYPE == VSM_32F
            float exponent = 15.0;
        #else
            float exponent = 5.54;
        #endif
        depth = 2.0 * depth - 1.0;
        depth =  exp(exponent * depth);
        gl_FragColor = vec4(depth, depth*depth, 1.0, 1.0);
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
