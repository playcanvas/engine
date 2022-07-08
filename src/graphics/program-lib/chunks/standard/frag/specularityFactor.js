export default /* glsl */`

#ifdef MAPFLOAT
uniform float material_specularityFactor;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_specularityFactorMap;
#endif

void getSpecularityFactor() {
    float specularityFactor = 1.0;

    #ifdef MAPFLOAT
    specularityFactor *= material_specularityFactor;
    #endif

    #ifdef MAPTEXTURE
    specularityFactor *= texture2D(texture_specularityFactorMap, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    specularityFactor *= saturate(vVertexColor.$VC);
    #endif

    dSpecularityFactor = specularityFactor;
}
`;
