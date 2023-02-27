export default /* glsl */`

uniform float material_f0;

void getMetalnessModulate(inout Frontend frontend) {
    vec3 dielectricF0 = material_f0 * frontend.specularity;
    frontend.specularity = mix(dielectricF0, frontend.albedo, frontend.metalness);
    frontend.albedo *= 1.0 - frontend.metalness;
}
`;
