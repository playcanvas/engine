export default /* glsl */`
float calcLightSpecular(float tGlossiness, vec3 tReflDirW, vec3 h, vec3 lightDirNorm) {
    float specPow = tGlossiness;

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return pow(max(dot(tReflDirW, -lightDirNorm), 0.0), specPow + 0.0001);
}

float getLightSpecular(vec3 h, vec3 reflDir, vec3 worldNormal, vec3 viewDir, float gloss, mat3 tbn) {
    return calcLightSpecular(gloss, reflDir, h);
}
`;
