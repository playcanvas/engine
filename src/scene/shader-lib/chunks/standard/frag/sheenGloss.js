export default /* glsl */`
uniform float material_sheenGloss;

void getSheenGlossiness() {
    float sheenGlossiness = material_sheenGloss;

    #ifdef MAPTEXTURE
    sheenGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    sheenGlossiness *= saturate(vVertexColor.$VC);
    #endif

    #ifdef MAPINVERT
    sheenGlossiness = 1.0 - sheenGlossiness;
    #endif

    sheenGlossiness += 0.0000001;
    sGlossiness = sheenGlossiness;
}
`;
