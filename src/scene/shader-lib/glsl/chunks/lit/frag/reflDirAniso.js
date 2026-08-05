export default /* glsl */`
void getReflDir(vec3 worldNormal, vec3 viewDir, float gloss, mat3 tbn) {
    float roughness = sqrt(1.0 - min(gloss, 1.0));

    vec2 direction = dAnisotropyRotation;
    vec3 anisotropicT = normalize(tbn * vec3(direction, 0.0));
    vec3 anisotropicB = normalize(cross(tbn[2], anisotropicT));

    float anisotropy = dAnisotropy;
    vec3 anisotropicDirection = anisotropicB;
    vec3 anisotropicTangent = cross(anisotropicDirection, viewDir);
    vec3 anisotropicNormal = cross(anisotropicTangent, anisotropicDirection);
    float bendFactor = 1.0 - anisotropy * (1.0 - roughness);
    float bendFactor4 = bendFactor * bendFactor * bendFactor * bendFactor;
    vec3 bentNormal = normalize(mix(normalize(anisotropicNormal), normalize(worldNormal), bendFactor4));
    dReflDirW = reflect(-viewDir, bentNormal);
}
`;
