export default /* glsl */`

float sheenD(vec3 normal, vec3 h, float roughness) {
    float invR = 1.0 / (roughness * roughness);
    float cos2h = max(dot(normal, h), 0.0);
    cos2h *= cos2h;
    float sin2h = max(1.0 - cos2h, 0.0078125);
    return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * PI);
}

float sheenV(vec3 normal, vec3 view, vec3 light) {
    float NoV = max(dot(normal, view), 0.000001);
    float NoL = max(dot(normal, light), 0.000001);
    return 1.0 / (4.0 * (NoL + NoV - NoL * NoV));
}

float getLightSpecularSheen(vec3 h) {
    float D = sheenD(dNormalW, h, sGlossiness);
    float V = sheenV(dNormalW, dViewDirW, -dLightDirNormW);
    return D * V;
}

void addReflectionSheen() {
    float NoV = dot(dNormalW, dViewDirW);
    float alphaG = sGlossiness * sGlossiness;

    // Avoid using a LUT and approximate the values analytically
    float a = sGlossiness < 0.25 ? -339.2 * alphaG + 161.4 * sGlossiness - 25.9 : -8.48 * alphaG + 14.3 * sGlossiness - 9.95;
    float b = sGlossiness < 0.25 ? 44.0 * alphaG - 23.7 * sGlossiness + 3.26 : 1.97 * alphaG - 3.27 * sGlossiness + 0.72;
    float DG = exp( a * NoV + b ) + ( sGlossiness < 0.25 ? 0.0 : 0.1 * ( sGlossiness - 0.25 ) );
    sReflection += vec4(calcReflection(dReflDirW, sGlossiness), saturate(DG * 1.0/PI));
}
`;
