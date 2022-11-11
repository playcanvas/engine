export default /* glsl */`
float calcLightSpecular(float tGlossiness, vec3 tReflDirW, vec3 h) {
    float specPow = tGlossiness;

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return pow(max(dot(tReflDirW, -dLightDirNormW), 0.0), specPow + 0.0001);
}

float getLightSpecular(vec3 h) {
    return calcLightSpecular(dGlossiness, dReflDirW, h);
}

#ifdef LIT_CLEARCOAT
float getLightSpecularCC(vec3 h) {
    return calcLightSpecular(ccGlossiness, ccReflDirW,h );
}
#endif
`;
