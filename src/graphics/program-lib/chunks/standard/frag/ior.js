export default /* glsl */`

#ifdef MAPFLOAT
uniform float material_refractionIndex;
#endif

void getRefractionIndex() {
    float refractionIndex = 1.5;

    #ifdef MAPFLOAT
    refractionIndex = material_refractionIndex;
    #endif

    dIor = refractionIndex;
}
`;
