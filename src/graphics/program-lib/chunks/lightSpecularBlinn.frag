// Energy-conserving (hopefully) Blinn-Phong
float getLightSpecular() {
    vec3 h = normalize( -dLightDirNormW + dViewDirW );
    float nh = max( dot( h, dNormalW ), 0.0 );

    float specPow = exp2(dGlossiness * 11.0); // glossiness is linear, power is not; 0 - 2048
    specPow = antiAliasGlossiness(specPow);

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    specPow = max(specPow, 0.0001);

    return pow(nh, specPow) * (specPow + 2.0) / 8.0;
}

