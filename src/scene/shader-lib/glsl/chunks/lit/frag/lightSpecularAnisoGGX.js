export default /* glsl */`
// Anisotropic GGX
float calcLightSpecular(float gloss, vec3 worldNormal, vec3 viewDir, vec3 h, vec3 lightDirNorm, mat3 tbn) {
    float PI = 3.141592653589793;
    float roughness = max((1.0 - gloss) * (1.0 - gloss), 0.001);
    float alphaRoughness = roughness * roughness;
    float anisotropy = dAnisotropy;
    vec2 direction = dAnisotropyRotation;

    float at = mix(alphaRoughness, 1.0, anisotropy * anisotropy);
    float ab = clamp(alphaRoughness, 0.001, 1.0);

    vec3 anisotropicT = normalize(tbn * vec3(direction, 0.0));
    vec3 anisotropicB = normalize(cross(tbn[2], anisotropicT));

    float NoH = dot(worldNormal, h);
    float ToH = dot(anisotropicT, h);
    float BoH = dot(anisotropicB, h);

    float a2 = at * ab;
    vec3 v = vec3(ab * ToH, at * BoH, a2 * NoH);
    float v2 = dot(v, v);
    float w2 = a2 / v2;
    float D = a2 * w2 * w2 * (1.0 / PI);

    float ToV = dot(anisotropicT, viewDir);
    float BoV = dot(anisotropicB, viewDir);
    float ToL = dot(anisotropicT, -lightDirNorm);
    float BoL = dot(anisotropicB, -lightDirNorm);
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
