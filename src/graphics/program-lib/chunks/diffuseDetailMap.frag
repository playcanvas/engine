#ifdef MAPTEXTURE
uniform sampler2D texture_diffuseDetailMap;
#endif

vec3 addAlbedoDetail(vec3 albedo) {
    #ifdef MAPTEXTURE
        vec3 albedoDetail = vec3(texture2D(texture_diffuseDetailMap, $UV).$CH);
        return detailBlend_$DETAILBLEND(albedo, albedoDetail);
    #else
        return albedo;
    #endif
}

