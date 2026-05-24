export default /* glsl */`
// Schlick's approximation
vec3 getFresnel(
        float cosTheta, 
        float gloss, 
        vec3 specularity
#if defined(LIT_IRIDESCENCE)
        , vec3 iridescenceFresnel, 
        float iridescenceIntensity
#endif
    ) {
    // pow(x, 5) expanded into multiplies to avoid the log2/exp2 pair pow compiles to
    float x = 1.0 - saturate(cosTheta);
    float x2 = x * x;
    float fresnel = x2 * x2 * x;
    float glossSq = gloss * gloss;

    // Scale gloss contribution by specularity intensity to ensure F90 approaches 0 when F0 is 0
    float specIntensity = max(specularity.r, max(specularity.g, specularity.b));
    vec3 ret = specularity + (max(vec3(glossSq * specIntensity), specularity) - specularity) * fresnel;

#if defined(LIT_IRIDESCENCE)
    return mix(ret, iridescenceFresnel, iridescenceIntensity);
#else
    return ret;
#endif    
}

float getFresnelCC(float cosTheta) {
    // pow(x, 5) expanded into multiplies to avoid the log2/exp2 pair pow compiles to
    float x = 1.0 - saturate(cosTheta);
    float x2 = x * x;
    float fresnel = x2 * x2 * x;
    return 0.04 + (1.0 - 0.04) * fresnel;
}
`;
