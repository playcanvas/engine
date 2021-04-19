void getReflDir() {
    RMEDP float roughness = sqrt(1.0 - min(dGlossiness, 1.0));
    RMEDP float anisotropy = material_anisotropy * roughness;
    RMEDP vec3 anisotropicDirection = anisotropy >= 0.0 ? dTBN[1] : dTBN[0];
    RMEDP vec3 anisotropicTangent = cross(anisotropicDirection, dViewDirW);
    RMEDP vec3 anisotropicNormal = cross(anisotropicTangent, anisotropicDirection);
    RMEDP vec3 bentNormal = normalize(mix(normalize(dNormalW), normalize(anisotropicNormal), anisotropy));
    dReflDirW = reflect(-dViewDirW, bentNormal);
}
