// Energy-conserving (hopefully) Blinn-Phong
vec3 calcLightSpecular(float tGlossiness, vec3 tNormalW, vec3 F0, out vec3 tFresnel) {
    vec3 h = normalize( -dLightDirNormW + dViewDirW );
    float nh = max( dot( h, tNormalW ), 0.0 );

    float specPow = exp2(tGlossiness * 11.0); // glossiness is linear, power is not; 0 - 2048
    specPow = antiAliasGlossiness(specPow);

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    specPow = max(specPow, 0.0001);

    vec3 F = calcFresnel(nh, F0);

    tFresnel = F;

    return F * pow(nh, specPow) * (specPow + 2.0) / 8.0;
}

vec3 getLightSpecular() {
    return calcLightSpecular(dGlossiness, dNormalW, dSpecularity, dLightFresnel);
}

vec3 getLightSpecularCC() {
    return calcLightSpecular(ccGlossiness, ccNormalW, vec3(ccSpecularity), ccLightFresnel);
}
