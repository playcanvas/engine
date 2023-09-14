export default /* glsl */`

void addReflectionSheen(vec3 worldNormal, vec3 viewDir, float gloss) {
    float NoV = dot(worldNormal, viewDir);
    float alphaG = gloss * gloss;

    // Avoid using a LUT and approximate the values analytically
    float a = gloss < 0.25 ? -339.2 * alphaG + 161.4 * gloss - 25.9 : -8.48 * alphaG + 14.3 * gloss - 9.95;
    float b = gloss < 0.25 ? 44.0 * alphaG - 23.7 * gloss + 3.26 : 1.97 * alphaG - 3.27 * gloss + 0.72;
    float DG = exp( a * NoV + b ) + ( gloss < 0.25 ? 0.0 : 0.1 * ( gloss - 0.25 ) );
    sReflection += calcReflection(worldNormal, 0.0) * saturate(DG);
}
`;
