export default /* glsl */`
#ifdef MAPFLOAT
uniform float material_sheenGlossiness;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_sheenGlossinessMap;
#endif

void getSheenGlossiness() {
    float sheenGlossiness = 1.0;

    #ifdef MAPFLOAT
    sheenGlossiness *= material_sheenGlossiness;
    #endif

    #ifdef MAPTEXTURE
    sheenGlossiness *= texture2D(texture_sheenGlossinessMap, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    sheenGlossiness *= saturate(vVertexColor.$VC);
    #endif

    sheenGlossiness += 0.0000001;
}
`;
