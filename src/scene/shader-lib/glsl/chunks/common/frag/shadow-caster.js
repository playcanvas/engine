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

    #if SHADOW_TYPE == VSM_16F || SHADOW_TYPE == VSM_32F

        // Rasterization of degenerate triangles, which animated meshes can generate, can supply
        // depth outside of the [0, 1] range or even NaN. The exponential warp below turns those
        // into huge values, which the VSM blur then spreads over a large area, generating visible
        // artifacts. Note that the depth range is not clipped for other shadow types, as they
        // either store the depth using the depth buffer, which clamps it, or the error is limited
        // to the individual texels and so is not noticeable.
        if (!(depth >= 0.0 && depth <= 1.0)) discard;

        // exponential warp of the depth, stored with its square
        #if SHADOW_TYPE == VSM_32F
            float exponent = 15.0;
        #else
            float exponent = 5.54;
        #endif
        depth = 2.0 * depth - 1.0;
        depth = exp(exponent * depth);
        return vec4(depth, depth * depth, 1.0, 1.0);

    #elif SHADOW_TYPE == PCSS_32F

        // depth is stored in R32F texture
        return vec4(depth, 0.0, 0.0, 1.0);

    #else

        // depth is stored in the depth buffer by the rasterizer, color is not used
        return vec4(1.0);

    #endif
}
`;
