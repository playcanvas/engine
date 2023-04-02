export default /* glsl */`
void getReflDir(vec3 worldNormal, vec3 viewDir, float gloss, mat3 tbn) {
    float roughness = sqrt(1.0 - min(gloss, 1.0));
    float anisotropy = material_anisotropy * roughness;
    vec3 anisotropicDirection = anisotropy >= 0.0 ? tbn[1] : tbn[0];
    vec3 anisotropicTangent = cross(anisotropicDirection, viewDir);
    vec3 anisotropicNormal = cross(anisotropicTangent, anisotropicDirection);
    vec3 bentNormal = normalize(mix(normalize(worldNormal), normalize(anisotropicNormal), anisotropy));
    dReflDirW = reflect(-viewDir, bentNormal);
}
`;
