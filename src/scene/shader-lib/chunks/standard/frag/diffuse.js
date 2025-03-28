export default /* glsl */`
uniform vec3 material_diffuse;

void getAlbedo() {
    dAlbedo = material_diffuse.rgb;

#ifdef STD_DIFFUSE_TEXTURE
    vec3 albedoBase = {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSE_TEXTURE_NAME}, {STD_DIFFUSE_TEXTURE_UV}, textureBias)).{STD_DIFFUSE_TEXTURE_CHANNEL};
    dAlbedo *= addAlbedoDetail(albedoBase);
#endif

#ifdef STD_DIFFUSE_VERTEX
    dAlbedo *= gammaCorrectInput(saturate(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL}));
#endif
}
`;
