// Energy-conserving (hopefully) Blinn-Phong
float calcLightSpecular(float tGlossiness, vec3 tNormalW) {
    vec3 h = normalize( -dLightDirNormW + dViewDirW );
    float nh = max( dot( h, tNormalW ), 0.0 );

    float specPow = exp2(tGlossiness * 11.0); // glossiness is linear, power is not; 0 - 2048
    specPow = antiAliasGlossiness(specPow);

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    specPow = max(specPow, 0.0001);

    return pow(nh, specPow) * (specPow + 2.0) / 8.0;
}

float getLightSpecular() {
    return calcLightSpecular(dGlossiness, dNormalW);
}

float getLightSpecularCC() {
    return calcLightSpecular(ccGlossiness, ccNormalW);
}
