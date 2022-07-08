export default /* glsl */`
void getMetalnessModulate(float ior) {
    vec3 dielectricF0 = ior * dSpecularity;
    dSpecularity = mix(dielectricF0, dAlbedo, dMetalness);
    dAlbedo *= 1.0 - dMetalness;
}
`;
