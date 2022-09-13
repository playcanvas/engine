export default /* glsl */`
#ifdef MAPFLOAT
uniform float material_iridescence;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_iridescenceMap;
#endif

void getIridescence() {
    float iridescence = 1.0;

    #ifdef MAPFLOAT
    iridescence *= material_iridescence;
    #endif

    #ifdef MAPTEXTURE
    iridescence *= texture2DBias(texture_iridescenceMap, $UV, textureBias).$CH;
    #endif

    dIridescence = iridescence; 
}
`;
