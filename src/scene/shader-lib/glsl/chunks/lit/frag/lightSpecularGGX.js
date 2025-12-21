export default /* glsl */`
// Isotropic GGX (glTF 2.0 compliant)
float calcLightSpecular(float gloss, vec3 worldNormal, vec3 viewDir, vec3 h, vec3 lightDirNorm) {
    float PI = 3.141592653589793;
    float roughness = max((1.0 - gloss) * (1.0 - gloss), 0.001);
    float alpha = roughness * roughness;

    float NoH = max(dot(worldNormal, h), 0.0);
    float NoV = max(dot(worldNormal, viewDir), 0.0);
    float NoL = max(dot(worldNormal, -lightDirNorm), 0.0);

    // GGX Distribution
    float NoH2 = NoH * NoH;
    float denom = NoH2 * (alpha - 1.0) + 1.0;
    float D = alpha / (PI * denom * denom);

    // Smith G (height-correlated)
    float alpha2 = alpha * alpha;
    float lambdaV = NoL * sqrt(NoV * NoV * (1.0 - alpha2) + alpha2);
    float lambdaL = NoV * sqrt(NoL * NoL * (1.0 - alpha2) + alpha2);
    float G = 0.5 / max(lambdaV + lambdaL, 0.00001);

    return D * G;
}

float getLightSpecular(vec3 h, vec3 reflDir, vec3 worldNormal, vec3 viewDir, vec3 lightDirNorm, float gloss, mat3 tbn) {
    return calcLightSpecular(gloss, worldNormal, viewDir, h, lightDirNorm);
}
`;

