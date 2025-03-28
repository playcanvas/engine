export default /* glsl */`
vec3 addAlbedoDetail(vec3 albedo) {
#ifdef STD_DIFFUSEDETAIL_TEXTURE
    vec3 albedoDetail = {STD_DIFFUSEDETAIL_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSEDETAIL_TEXTURE_NAME}, {STD_DIFFUSEDETAIL_TEXTURE_UV}, textureBias)).{STD_DIFFUSEDETAIL_TEXTURE_CHANNEL};
    return detailMode_{STD_DIFFUSEDETAIL_DETAILMODE}(albedo, albedoDetail);
#else
    return albedo;
#endif
}
`;
