// Anisotropic GGX
float calcLightSpecular(float tGlossiness, vec3 tNormalW) {
    LMEDP float PI = 3.141592653589793;
    LMEDP float roughness = max((1.0 - tGlossiness) * (1.0 - tGlossiness), 0.001);
    LMEDP float anisotropy = material_anisotropy * roughness;
 
    LMEDP float at = max((roughness + anisotropy), roughness / 4.0);
    LMEDP float ab = max((roughness - anisotropy), roughness / 4.0);

    LMEDP vec3 h = normalize(normalize(-dLightDirNormW) + normalize(dViewDirW));

    LMEDP float NoH = dot(tNormalW, h);
    LMEDP float ToH = dot(dTBN[0], h);
    LMEDP float BoH = dot(dTBN[1], h);

    LMEDP float a2 = at * ab;
    LMEDP vec3 v = vec3(ab * ToH, at * BoH, a2 * NoH);
    LMEDP float v2 = dot(v, v);
    LMEDP float w2 = a2 / v2;
    LMEDP float D = a2 * w2 * w2 * (1.0 / PI);

    LMEDP float ToV = dot(dTBN[0], dViewDirW);
    LMEDP float BoV = dot(dTBN[1], dViewDirW);
    LMEDP float ToL = dot(dTBN[0], -dLightDirNormW);
    LMEDP float BoL = dot(dTBN[1], -dLightDirNormW);
    LMEDP float NoV = dot(tNormalW, dViewDirW);
    LMEDP float NoL = dot(tNormalW, -dLightDirNormW);

    LMEDP float lambdaV = NoL * length(vec3(at * ToV, ab * BoV, NoV));
    LMEDP float lambdaL = NoV * length(vec3(at * ToL, ab * BoL, NoL));
    LMEDP float G = 0.5 / (lambdaV + lambdaL);

    return D * G;
}

float getLightSpecular() {
    return calcLightSpecular(dGlossiness, dNormalW);
}

float getLightSpecularCC() {
    return calcLightSpecular(ccGlossiness, ccNormalW);
}
