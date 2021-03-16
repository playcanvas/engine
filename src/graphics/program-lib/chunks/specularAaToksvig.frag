float antiAliasGlossiness(float power) {
    MEDP float rlen = 1.0 / saturate(length(dNormalMap));
    MEDP float toksvig = 1.0 / (1.0 + power * (rlen - 1.0));
    return power * mix(1.0, toksvig, material_bumpiness);
}
