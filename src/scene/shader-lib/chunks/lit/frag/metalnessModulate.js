export default /* glsl */`

uniform float material_f0;

void getMetalnessModulate(inout Frontend frontend) {
    vec3 dielectricF0 = material_f0 * frontend.dSpecularity;
    frontend.dSpecularity = mix(dielectricF0, frontend.dAlbedo, frontend.dMetalness);
    frontend.dAlbedo *= 1.0 - frontend.dMetalness;
}
`;
