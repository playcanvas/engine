#ifdef MAPTEXTURE
uniform sampler2D texture_diffuseDetailMap;
#endif

vec3 addAlbedoDetail(vec3 albedo) {
    #ifdef MAPTEXTURE
    MMEDP vec3 albedoDetail = vec3(texture2D(texture_diffuseDetailMap, $UV).$CH);
    return detailMode_$DETAILMODE(albedo, albedoDetail);
    #else
    return albedo;
    #endif
}
