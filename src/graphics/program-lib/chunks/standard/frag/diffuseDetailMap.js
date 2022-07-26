export default /* glsl */`
#ifdef MAPTEXTURE
uniform sampler2D texture_diffuseDetailMap;
#endif

vec3 addAlbedoDetail(vec3 albedo) {
#ifdef MAPTEXTURE
    vec3 albedoDetail = gammaCorrectInput(texture2D(texture_diffuseDetailMap, $UV, textureBias).$CH);
    return detailMode_$DETAILMODE(albedo, albedoDetail);
#else
    return albedo;
#endif
}
`;
