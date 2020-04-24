// Anisotropic GGX
float calcLightSpecular(float tGlossiness, vec3 tNormalW) {
    float PI = 3.141592653589793;
    float roughness = max((1.0 - tGlossiness) * (1.0 - tGlossiness), 0.001);
    float anisotropy = material_anisotropy * roughness;
 
    float at = max((roughness + anisotropy), roughness / 4.0);
    float ab = max((roughness - anisotropy), roughness / 4.0);

    vec3 h = normalize(normalize(-dLightDirNormW) + normalize(dViewDirW));

    float NoH = dot(tNormalW, h);
    float ToH = dot(dTBN[0], h);
    float BoH = dot(dTBN[1], h);

    float a2 = at * ab;
    vec3 v = vec3(ab * ToH, at * BoH, a2 * NoH);
    float v2 = dot(v, v);
    float w2 = a2 / v2;
    float D = a2 * w2 * w2 * (1.0 / PI);

    float ToV = dot(dTBN[0], dViewDirW);
    float BoV = dot(dTBN[1], dViewDirW);
    float ToL = dot(dTBN[0], -dLightDirNormW);
    float BoL = dot(dTBN[1], -dLightDirNormW);
    float NoV = dot(tNormalW, dViewDirW);
    float NoL = dot(tNormalW, -dLightDirNormW);

    float lambdaV = NoL * length(vec3(at * ToV, ab * BoV, NoV));
    float lambdaL = NoV * length(vec3(at * ToL, ab * BoL, NoL));
    float G = 0.5 / (lambdaV + lambdaL);

    return D * G;
}

float getLightSpecular() {
    return calcLightSpecular(dGlossiness, dNormalW);
}

float getLightSpecularCC() {
    return calcLightSpecular(ccGlossiness, ccNormalW);
}
