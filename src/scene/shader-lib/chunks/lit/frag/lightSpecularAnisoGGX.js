export default /* glsl */`
// Anisotropic GGX
float calcLightSpecular(float gloss, vec3 worldNormal, vec3 viewDir, vec3 h, vec3 lightDirNorm, mat3 tbn) {
    float PI = 3.141592653589793;
    float roughness = max((1.0 - gloss) * (1.0 - gloss), 0.001);
    float anisotropy = material_anisotropy * roughness;
 
    float at = max((roughness + anisotropy), roughness / 4.0);
    float ab = max((roughness - anisotropy), roughness / 4.0);

    float NoH = dot(worldNormal, h);
    float ToH = dot(tbn[0], h);
    float BoH = dot(tbn[1], h);

    float a2 = at * ab;
    vec3 v = vec3(ab * ToH, at * BoH, a2 * NoH);
    float v2 = dot(v, v);
    float w2 = a2 / v2;
    float D = a2 * w2 * w2 * (1.0 / PI);

    float ToV = dot(tbn[0], viewDir);
    float BoV = dot(tbn[1], viewDir);
    float ToL = dot(tbn[0], -lightDirNorm);
    float BoL = dot(tbn[1], -lightDirNorm);
    float NoV = dot(worldNormal, viewDir);
    float NoL = dot(worldNormal, -lightDirNorm);

    float lambdaV = NoL * length(vec3(at * ToV, ab * BoV, NoV));
    float lambdaL = NoV * length(vec3(at * ToL, ab * BoL, NoL));
    float G = 0.5 / (lambdaV + lambdaL);

    return D * G;
}

float getLightSpecular(vec3 h, vec3 reflDir, vec3 worldNormal, vec3 viewDir, vec3 lightDirNorm, float gloss, mat3 tbn) {
    return calcLightSpecular(gloss, worldNormal, viewDir, h, lightDirNorm, tbn);
}
`;
