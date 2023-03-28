export default /* glsl */`
uniform float material_refractionIndex;

vec3 refract2(vec3 viewVec, vec3 normal, float IOR) {
    float vn = dot(viewVec, normal);
    float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * normal;
    return refrVec;
}

void addRefraction(
    vec3 worldNormal, 
    vec3 viewDir, 
    float thickness, 
    float gloss, 
    vec3 specularity, 
    vec3 albedo, 
    float transmission
#if defined(LIT_IRIDESCENCE)
    , vec3 iridescenceFresnel,
    IridescenceArgs iridescence
#endif 
) {
    // use same reflection code with refraction vector
    vec4 tmpRefl = dReflection;
    vec3 reflectionDir = refract2(-viewDir, worldNormal, material_refractionIndex);
    dReflection = vec4(0);
    addReflection(reflectionDir, gloss);
    dDiffuseLight = mix(dDiffuseLight, dReflection.rgb * albedo, transmission);
    dReflection = tmpRefl;
}
`;
