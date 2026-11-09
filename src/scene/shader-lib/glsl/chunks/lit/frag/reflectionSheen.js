export default /* glsl */`

void addReflectionSheen(vec3 worldNormal, vec3 viewDir, float gloss) {
    float NoV = dot(worldNormal, viewDir);
    float roughness = 1.0 - gloss;
    float alphaG = roughness * roughness;

    // Avoid using a LUT and approximate the values analytically, as a function of the roughness
    float a = roughness < 0.25 ? -339.2 * alphaG + 161.4 * roughness - 25.9 : -8.48 * alphaG + 14.3 * roughness - 9.95;
    float b = roughness < 0.25 ? 44.0 * alphaG - 23.7 * roughness + 3.26 : 1.97 * alphaG - 3.27 * roughness + 0.72;
    float DG = exp( a * NoV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
    sReflection += calcReflection(worldNormal, 0.0) * saturate(DG);
}
`;
