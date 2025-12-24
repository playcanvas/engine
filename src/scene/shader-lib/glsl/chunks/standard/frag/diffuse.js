export default /* glsl */`
uniform vec3 material_diffuse;

#ifdef STD_DIFFUSEDETAIL_TEXTURE
    #include "detailModesPS"
#endif

void getAlbedo() {
    dAlbedo = material_diffuse.rgb;

    #ifdef STD_DIFFUSE_TEXTURE
        vec3 albedoTexture = {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSE_TEXTURE_NAME}, {STD_DIFFUSE_TEXTURE_UV}, textureBias)).{STD_DIFFUSE_TEXTURE_CHANNEL};

        #ifdef STD_DIFFUSEDETAIL_TEXTURE
            vec3 albedoDetail = {STD_DIFFUSEDETAIL_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSEDETAIL_TEXTURE_NAME}, {STD_DIFFUSEDETAIL_TEXTURE_UV}, textureBias)).{STD_DIFFUSEDETAIL_TEXTURE_CHANNEL};
            albedoTexture = detailMode_{STD_DIFFUSEDETAIL_DETAILMODE}(albedoTexture, albedoDetail);
        #endif

        dAlbedo *= albedoTexture;
    #endif

    #ifdef STD_DIFFUSE_VERTEX
        dAlbedo *= saturate(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL});
    #endif
}
`;
