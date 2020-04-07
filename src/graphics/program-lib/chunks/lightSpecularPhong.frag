float getLightSpecular() {
    float specPow = dGlossiness;

    specPow = antiAliasGlossiness(specPow);

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return pow(max(dot(dReflDirW, -dLightDirNormW), 0.0), specPow + 0.0001);
}

float getLightSpecularCC() {
    float specPow = ccGlossiness;

    specPow = antiAliasGlossiness(specPow);

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return pow(max(dot(ccReflDirW, -dLightDirNormW), 0.0), specPow + 0.0001);
}
