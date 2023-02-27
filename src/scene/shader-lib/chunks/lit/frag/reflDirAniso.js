export default /* glsl */`
void getReflDir(Frontend frontend) {
    float roughness = sqrt(1.0 - min(frontend.glossiness, 1.0));
    float anisotropy = material_anisotropy * roughness;
    vec3 anisotropicDirection = anisotropy >= 0.0 ? dTBN[1] : dTBN[0];
    vec3 anisotropicTangent = cross(anisotropicDirection, dViewDirW);
    vec3 anisotropicNormal = cross(anisotropicTangent, anisotropicDirection);
    vec3 bentNormal = normalize(mix(normalize(frontend.worldNormal), normalize(anisotropicNormal), anisotropy));
    dReflDirW = reflect(-dViewDirW, bentNormal);
}
`;
