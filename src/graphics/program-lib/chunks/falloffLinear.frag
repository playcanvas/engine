float getFalloffLinear(float lightRadius) {
    MEDP float d = length(dLightDirW);
    return max(((lightRadius - d) / lightRadius), 0.0);
}
