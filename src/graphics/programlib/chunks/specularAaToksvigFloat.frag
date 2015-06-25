float antiAliasGlossiness(inout psInternalData data, float power) {
    float rlen = 1.0 / saturate(length(data.normalMap));
    float toksvig = 1.0 / (1.0 + power * (rlen - 1.0));
    return power * mix(1.0, toksvig, material_bumpiness);
}

