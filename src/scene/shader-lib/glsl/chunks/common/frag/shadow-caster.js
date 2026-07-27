// Shadow pass support for custom shaders (for example ShaderMaterial). Include this chunk when
// SHADOW_PASS is defined, and write its result to the output color:
//     gl_FragColor = getShadowOutput();
//
// Supported are all shadow types for directional lights, and PCF shadows for spot lights. Omni
// lights and VSM shadows for spot lights are not supported, as those require distance based depth.
export default /* glsl */`

vec4 getShadowOutput() {

    // rasterized depth
    float depth = gl_FragCoord.z;

    // protect against rasterization of degenerate triangles of animated meshes, which can generate
    // out of range / NaN depth - VSM blur would smear those into large visible artifacts
    if (!(depth >= 0.0 && depth <= 1.0)) discard;

    #if SHADOW_TYPE == VSM_16F || SHADOW_TYPE == VSM_32F

        float d = 2.0 * depth - 1.0;

        #if SHADOW_TYPE == VSM_32F

            // EVSM4 - a positive and a negative exponential warp, each with its second moment.
            // Note: these exponents must match those used by the shadowEVSM chunk.
            float pos = exp(15.0 * d);
            float neg = exp(-5.0 * d);
            return vec4(pos, pos * pos, -neg, neg * neg);

        #else

            // EVSM2 - a single exponential warp with its second moment, z stores the coverage
            float pos = exp(5.54 * d);
            return vec4(pos, pos * pos, 1.0, 1.0);

        #endif

    #elif SHADOW_TYPE == PCSS_32F

        // depth is stored in R32F texture
        return vec4(depth, 0.0, 0.0, 1.0);

    #else

        // depth is stored in the depth buffer by the rasterizer, color is not used
        return vec4(1.0);

    #endif
}
`;
