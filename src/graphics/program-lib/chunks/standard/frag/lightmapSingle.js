export default /* glsl */`
#ifdef MAPTEXTURE
uniform sampler2D texture_lightMap;
#endif

void getLightMap() {
    dLightmap = vec3(1.0);

    #ifdef MAPTEXTURE
    dLightmap *= $DECODE(texture2D(texture_lightMap, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    dLightmap *= saturate(vVertexColor.$VC);
    #endif
}
`;
