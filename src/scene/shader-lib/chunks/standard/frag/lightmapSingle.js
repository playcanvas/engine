export default /* glsl */`
void getLightMap() {
    dLightmap = vec3(1.0);

    #ifdef STD_LIGHT_TEXTURE_ENABLED
    dLightmap *= {STD_LIGHT_TEXTURE_DECODE}(texture2DBias({STD_LIGHT_TEXTURE}, {STD_LIGHT_TEXTURE_UV}, textureBias)).{STD_LIGHT_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_LIGHT_VERTEX_ENABLED
    dLightmap *= saturate(vVertexColor.{STD_LIGHT_VERTEX_CHANNEL});
    #endif
}
`;
