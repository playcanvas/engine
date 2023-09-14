export default /* glsl */`
#ifdef MAPFLOAT
uniform float material_refractionIndex;
#endif

void getIor() {
#ifdef MAPFLOAT
    dIor = material_refractionIndex;
#else
    dIor = 1.0 / 1.5;
#endif
}
`;
