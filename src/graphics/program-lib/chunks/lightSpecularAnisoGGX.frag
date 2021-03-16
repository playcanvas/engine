// Anisotropic GGX
float calcLightSpecular(float tGlossiness, vec3 tNormalW) {
    MEDP float PI = 3.141592653589793;
    MEDP float roughness = max((1.0 - tGlossiness) * (1.0 - tGlossiness), 0.001);
    MEDP float anisotropy = material_anisotropy * roughness;
 
    MEDP float at = max((roughness + anisotropy), roughness / 4.0);
    MEDP float ab = max((roughness - anisotropy), roughness / 4.0);

    MEDP vec3 h = normalize(normalize(-dLightDirNormW) + normalize(dViewDirW));

    MEDP float NoH = dot(tNormalW, h);
    MEDP float ToH = dot(dTBN[0], h);
    MEDP float BoH = dot(dTBN[1], h);

    MEDP float a2 = at * ab;
    MEDP vec3 v = vec3(ab * ToH, at * BoH, a2 * NoH);
    MEDP float v2 = dot(v, v);
    MEDP float w2 = a2 / v2;
    MEDP float D = a2 * w2 * w2 * (1.0 / PI);

    MEDP float ToV = dot(dTBN[0], dViewDirW);
    MEDP float BoV = dot(dTBN[1], dViewDirW);
    MEDP float ToL = dot(dTBN[0], -dLightDirNormW);
    MEDP float BoL = dot(dTBN[1], -dLightDirNormW);
    MEDP float NoV = dot(tNormalW, dViewDirW);
    MEDP float NoL = dot(tNormalW, -dLightDirNormW);

    MEDP float lambdaV = NoL * length(vec3(at * ToV, ab * BoV, NoV));
    MEDP float lambdaL = NoV * length(vec3(at * ToL, ab * BoL, NoL));
    MEDP float G = 0.5 / (lambdaV + lambdaL);

    return D * G;
}

float getLightSpecular() {
    return calcLightSpecular(dGlossiness, dNormalW);
}

float getLightSpecularCC() {
    return calcLightSpecular(ccGlossiness, ccNormalW);
}
