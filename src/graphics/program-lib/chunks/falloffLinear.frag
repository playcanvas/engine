float getFalloffLinear(float lightRadius) {
    LMEDP float d = length(dLightDirW);
    return max(((lightRadius - d) / lightRadius), 0.0);
}
