// Shadow pass support for custom shaders (for example ShaderMaterial). Include this chunk when
// SHADOW_PASS is defined, and write its result to the output color:
//     output.color = getShadowOutput();
//
// Supported are all shadow types for directional lights, and PCF shadows for spot lights. Omni
// lights and VSM shadows for spot lights are not supported, as those require distance based depth.
export default /* wgsl */`

fn getShadowOutput() -> vec4f {

    // rasterized depth
    var depth: f32 = pcPosition.z;

    // protect against rasterization of degenerate triangles of animated meshes, which can generate
    // out of range / NaN depth - VSM blur would smear those into large visible artifacts
    if (!(depth >= 0.0 && depth <= 1.0)) {
        discard;
    }

    #if SHADOW_TYPE == VSM_16F || SHADOW_TYPE == VSM_32F

        let d: f32 = 2.0 * depth - 1.0;

        #if SHADOW_TYPE == VSM_32F

            // EVSM4 - a positive and a negative exponential warp, each with its second moment.
            // Note: these exponents must match those used by the shadowEVSM chunk.
            let pos: f32 = exp(15.0 * d);
            let neg: f32 = exp(-5.0 * d);
            return vec4f(pos, pos * pos, -neg, neg * neg);

        #else

            // EVSM2 - a single exponential warp with its second moment, z stores the coverage
            let pos: f32 = exp(5.54 * d);
            return vec4f(pos, pos * pos, 1.0, 1.0);

        #endif

    #elif SHADOW_TYPE == PCSS_32F

        // depth is stored in R32F texture
        return vec4f(depth, 0.0, 0.0, 1.0);

    #else

        // depth is stored in the depth buffer by the rasterizer, color is not used
        return vec4f(1.0);

    #endif
}
`;
