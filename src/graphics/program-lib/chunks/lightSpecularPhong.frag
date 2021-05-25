vec3 calcLightSpecular(float tGlossiness, vec3 tReflDirW, vec3 F0, out vec3 tFresnel) {
    float specPow = tGlossiness;

    specPow = antiAliasGlossiness(specPow);

    float rl = max(dot(tReflDirW, -dLightDirNormW), 0.0);

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return vec3(pow(rl, specPow + 0.0001));
}

vec3 getLightSpecular() {
    return calcLightSpecular(dGlossiness, dNormalW, dSpecularity, dLightFresnel);
}

vec3 getLightSpecularCC() {
    return calcLightSpecular(ccGlossiness, ccNormalW, vec3(ccSpecularity), ccLightFresnel);
}