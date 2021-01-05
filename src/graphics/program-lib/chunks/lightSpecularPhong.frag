float calcLightSpecular(float tGlossiness, vec3 tReflDirW) {
    float specPow = tGlossiness;

    specPow = antiAliasGlossiness(specPow);

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return pow(max(dot(tReflDirW, -dLightDirNormW), 0.0), specPow + 0.0001);
}

float getLightSpecular() {
    return calcLightSpecular(dGlossiness, dReflDirW);
}

float getLightSpecularCC() {
    return calcLightSpecular(ccGlossiness, ccReflDirW);
}
