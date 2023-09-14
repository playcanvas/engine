export default /* glsl */`
void addLightMap(
    vec3 lightmap, 
    vec3 dir, 
    vec3 worldNormal, 
    vec3 viewDir, 
    vec3 reflectionDir, 
    float gloss, 
    vec3 specularity, 
    vec3 vertexNormal, 
    mat3 tbn
#if defined(LIT_IRIDESCENCE)
    vec3 iridescenceFresnel, 
    float iridescenceIntensity
#endif
) {
    dDiffuseLight += lightmap;
}
`;
