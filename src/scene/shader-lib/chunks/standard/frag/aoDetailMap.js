export default /* glsl */`
float addAoDetail(float ao) {
#ifdef STD_AODETAIL_TEXTURE
    float aoDetail = texture2DBias({STD_AODETAIL_TEXTURE_NAME}, {STD_AODETAIL_TEXTURE_UV}, textureBias).{STD_AODETAIL_TEXTURE_CHANNEL};
    return detailMode_{STD_AODETAIL_DETAILMODE}(vec3(ao), vec3(aoDetail)).r;
#else
    return ao;
#endif
}
`;
