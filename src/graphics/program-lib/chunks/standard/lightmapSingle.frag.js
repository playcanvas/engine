export default /* glsl */`
#ifdef MAPTEXTURE
uniform sampler2D texture_lightMap;
#endif

void getLightMap() {
    dLightmap = vec3(1.0);

    #ifdef MAPTEXTURE
    dLightmap *= $texture2DSAMPLE(texture_lightMap, $UV).$CH;
    #endif

    #ifdef MAPVERTEX
    dLightmap *= saturate(vVertexColor.$VC);
    #endif
}
`;
