export default /* glsl */`

float sheenD(vec3 normal, vec3 h, float roughness) {
    const float PI = 3.141592653589793;
    // the floor on alpha keeps the distribution finite as the roughness reaches zero
    float invR = 1.0 / max(roughness * roughness, 0.001);
    float cos2h = max(dot(normal, h), 0.0);
    cos2h *= cos2h;
    float sin2h = max(1.0 - cos2h, 0.0078125);
    return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * PI);
}

float sheenV(vec3 normal, vec3 viewDir, vec3 light) {
    float NoV = max(dot(normal, viewDir), 0.000001);
    float NoL = max(dot(normal, light), 0.000001);
    return 1.0 / (4.0 * (NoL + NoV - NoL * NoV));
}

float getLightSpecularSheen(vec3 h, vec3 worldNormal, vec3 viewDir, vec3 lightDirNorm, float sheenGloss) {
    float D = sheenD(worldNormal, h, 1.0 - sheenGloss);
    float V = sheenV(worldNormal, viewDir, -lightDirNorm);
    return D * V;
}

// The directional albedo E of the sheen BRDF of KHR_materials_sheen is the fraction of the light that
// the sheen layer reflects, for a direction at the given cosine to the normal. It is evaluated from an
// analytic fit of the integrated BRDF, exp(c + a * cosTheta + b * cosTheta^2), which is within 0.02 of
// it for a cosine above 0.03. The coefficients (a, b, c) are rational in the roughness.
vec3 getSheenAlbedoFit(float roughness) {
    // the same floor as on alpha in the distribution
    float r = max(roughness, 0.0316);
    float a = -0.7903 / (r - 0.00608) - 1.125 + 0.2059 * r;
    float b = 0.5984 - 0.4032 / ((r + 0.0907) * (r + 0.0907));
    float c = 7.104 / (r + 0.5993) - 10.69 + r * (9.704 - 3.705 * r);
    return vec3(a, b, c);
}

float getSheenAlbedo(float cosTheta, vec3 fit) {
    return min(exp(fit.z + cosTheta * (fit.x + cosTheta * fit.y)), 1.0);
}

// The sheen layer reflects part of the light before it reaches the base layer, which is scaled by
// 1 - max3(sheenColor) * E. These hold the fit for the sheen roughness, the largest component of the
// sheen color, and the scaling for the view direction, which is applied to all of the base layer when
// combining.
vec3 sAlbedoFit;
float sMaxColor;
float sAlbedoScaling;

void calcSheenAlbedoScaling(vec3 worldNormal, vec3 viewDir, float sheenGloss, vec3 sheenColor) {
    sAlbedoFit = getSheenAlbedoFit(1.0 - sheenGloss);
    sMaxColor = max(max(sheenColor.r, sheenColor.g), sheenColor.b);
    sAlbedoScaling = max(1.0 - sMaxColor * getSheenAlbedo(max(dot(worldNormal, viewDir), 0.0), sAlbedoFit), 0.0);
}

// For a light, the base layer is scaled by the smaller of the scalings for the view and the light
// direction. The scaling for the view direction is applied when combining, so this returns the rest.
float getSheenLightScaling(vec3 worldNormal, vec3 lightDirNorm) {
    float scaling = max(1.0 - sMaxColor * getSheenAlbedo(max(dot(worldNormal, -lightDirNorm), 0.0), sAlbedoFit), 0.0);
    return min(scaling / max(sAlbedoScaling, 0.0001), 1.0);
}
`;
