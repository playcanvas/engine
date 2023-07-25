export default /* glsl */`
#ifdef MAPFLOAT
uniform float material_gloss;
#endif

void getGlossiness() {
    dGlossiness = 1.0;

    #ifdef MAPFLOAT
    dGlossiness *= material_gloss;
    #endif

    #ifdef MAPTEXTURE
    dGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    dGlossiness *= saturate(vVertexColor.$VC);
    #endif

    #ifdef MAPINVERT
    dGlossiness = 1.0 - dGlossiness;
    #endif

    dGlossiness += 0.0000001;
}
`;
