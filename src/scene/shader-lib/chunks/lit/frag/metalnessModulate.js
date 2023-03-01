export default /* glsl */`

uniform float material_f0;

void getMetalnessModulate(inout LitShaderArguments litShaderArgs) {
    vec3 dielectricF0 = material_f0 * litShaderArgs.specularity;
    litShaderArgs.specularity = mix(dielectricF0, litShaderArgs.albedo, litShaderArgs.metalness);
    litShaderArgs.albedo *= 1.0 - litShaderArgs.metalness;
}
`;
