export default /* glsl */`
#ifdef MAPFLOAT
uniform float material_clearCoatGloss;
#endif

void getClearCoatGlossiness() {
    ccGlossiness = 1.0;

    #ifdef MAPFLOAT
    ccGlossiness *= material_clearCoatGloss;
    #endif

    #ifdef MAPTEXTURE
    ccGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    ccGlossiness *= saturate(vVertexColor.$VC);
    #endif

    #ifdef MAPINVERT
    ccGlossiness = 1.0 - ccGlossiness;
    #endif

    ccGlossiness += 0.0000001;
}
`;
