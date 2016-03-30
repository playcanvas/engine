float antiAliasGlossiness(float power) {
    float rlen = 1.0 / saturate(length(dNormalMap));
    float toksvig = 1.0 / (1.0 + power * (rlen - 1.0));
    return power * mix(1.0, toksvig, material_bumpiness);
}

