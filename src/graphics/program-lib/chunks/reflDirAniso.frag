void getReflDir() {
    MEDP float roughness = sqrt(1.0 - min(dGlossiness, 1.0));
    MEDP float anisotropy = material_anisotropy * roughness;
    MEDP vec3 anisotropicDirection = anisotropy >= 0.0 ? dTBN[1] : dTBN[0];
    MEDP vec3 anisotropicTangent = cross(anisotropicDirection, dViewDirW);
    MEDP vec3 anisotropicNormal = cross(anisotropicTangent, anisotropicDirection);
    MEDP vec3 bentNormal = normalize(mix(normalize(dNormalW), normalize(anisotropicNormal), anisotropy));
    dReflDirW = reflect(-dViewDirW, bentNormal);
}
