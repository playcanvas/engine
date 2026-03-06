/**
 * WGSL shader chunk providing half-precision type aliases. When the device supports f16
 * (CAPS_SHADER_F16), these resolve to native f16 types. Otherwise, they fall back to f32.
 *
 * Available types: half, half2, half3, half4, half2x2, half3x3, half4x4
 *
 * Usage in WGSL shaders:
 * - Vertex/Fragment: automatically included
 * - Compute: #include "halfTypesCS"
 *
 * @ignore
 */
export default /* wgsl */`
#ifdef CAPS_SHADER_F16
    alias half = f16;
    alias half2 = vec2<f16>;
    alias half3 = vec3<f16>;
    alias half4 = vec4<f16>;
    alias half2x2 = mat2x2<f16>;
    alias half3x3 = mat3x3<f16>;
    alias half4x4 = mat4x4<f16>;
#else
    alias half = f32;
    alias half2 = vec2f;
    alias half3 = vec3f;
    alias half4 = vec4f;
    alias half2x2 = mat2x2f;
    alias half3x3 = mat3x3f;
    alias half4x4 = mat4x4f;
#endif
`;
