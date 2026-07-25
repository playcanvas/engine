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

    #if SHADOW_TYPE == VSM_16F || SHADOW_TYPE == VSM_32F

        // exponential warp of the depth, stored with its square
        #if SHADOW_TYPE == VSM_32F
            let exponent: f32 = 15.0;
        #else
            let exponent: f32 = 5.54;
        #endif
        depth = 2.0 * depth - 1.0;
        depth = exp(exponent * depth);
        return vec4f(depth, depth * depth, 1.0, 1.0);

    #elif SHADOW_TYPE == PCSS_32F

        // depth is stored in R32F texture
        return vec4f(depth, 0.0, 0.0, 1.0);

    #else

        // depth is stored in the depth buffer by the rasterizer, color is not used
        return vec4f(1.0);

    #endif
}
`;
