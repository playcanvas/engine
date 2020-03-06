void getReflDir() {
    float anisotropy=material_anisotropy;
    vec3 anisotropicDirection = anisotropy >= 0.0 ? dTBN[1] : dTBN[0];
    vec3 anisotropicTangent = cross(anisotropicDirection, dViewDirW);
    vec3 anisotropicNormal = cross(anisotropicTangent, anisotropicDirection);
    vec3 bentNormal = normalize(mix(dNormalW, anisotropicNormal, anisotropy));
    dReflDirW = reflect(-dViewDirW, bentNormal);
}
