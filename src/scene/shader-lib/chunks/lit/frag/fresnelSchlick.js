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
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    float glossSq = gloss * gloss;
    vec3 ret = specularity + (max(vec3(glossSq), specularity) - specularity) * fresnel;
#if defined(LIT_IRIDESCENCE)
    return mix(ret, iridescenceFresnel, iridescenceIntensity);
#else
    return ret;
#endif    
}

float getFresnelCC(float cosTheta) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    return 0.04 + (1.0 - 0.04) * fresnel;
}
`;
