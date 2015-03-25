float getLightSpecular(inout psInternalData data) {
    float specPow = data.glossiness;

    specPow = antiAliasGlossiness(data, specPow);

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return pow(max(dot(data.reflDirW, -data.lightDirNormW), 0.0), specPow + 0.0001);
}

