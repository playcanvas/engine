export default /* glsl */`
#ifdef STD_IOR_CONSTANT
uniform float material_refractionIndex;
#endif

void getIor() {
#ifdef STD_IOR_CONSTANT
    dIor = material_refractionIndex;
#else
    dIor = 1.0 / 1.5;
#endif
}
`;
