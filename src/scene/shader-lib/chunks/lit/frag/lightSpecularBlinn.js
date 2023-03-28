export default /* glsl */`
// Energy-conserving (hopefully) Blinn-Phong
float calcLightSpecular(float gloss, vec3 worldNormal, vec3 h) {
    float nh = max( dot( h, worldNormal ), 0.0 );

    float specPow = exp2(gloss * 11.0); // glossiness is linear, power is not; 0 - 2048

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    specPow = max(specPow, 0.0001);

    return pow(nh, specPow) * (specPow + 2.0) / 8.0;
}

float getLightSpecular(vec3 h, vec3 reflDir, vec3 worldNormal, vec3 viewDir, vec3 lightDirNorm, float gloss, mat3 tbn) {
    return calcLightSpecular(gloss, worldNormal, h);
}
`;
