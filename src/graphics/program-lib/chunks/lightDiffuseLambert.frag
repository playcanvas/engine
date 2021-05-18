float getLightDiffuse() {
    return float(1)*max(dot(dNormalW, -dLightDirNormW), 0.0);
}
