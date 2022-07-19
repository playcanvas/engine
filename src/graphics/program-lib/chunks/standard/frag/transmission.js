export default /* glsl */`

#ifdef MAPFLOAT
uniform float material_refraction;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_refractionMap;
#endif

void getRefraction() {
    float refraction = 1.0;

    #ifdef MAPFLOAT
    refraction = material_refraction;
    #endif

    #ifdef MAPTEXTURE
    refraction *= gammaCorrectInput(texture2D(texture_refractionMap, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    refraction *= saturate(vVertexColor.$VC);
    #endif

    dTransmission = refraction;
}
`;
