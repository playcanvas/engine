float antiAliasGlossiness(float power) {
    MMEDP float rlen = 1.0 / saturate(length(dNormalMap));
    MMEDP float toksvig = 1.0 / (1.0 + power * (rlen - 1.0));
    return power * toksvig;
}
