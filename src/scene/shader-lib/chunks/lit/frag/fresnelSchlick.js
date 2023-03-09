export default /* glsl */`
// Schlick's approximation
vec3 getFresnel(float cosTheta, float gloss, vec3 specularity, IridescenceArgs iridescence) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    float glossSq = gloss * gloss;
    vec3 ret = specularity + (max(vec3(glossSq), specularity) - specularity) * fresnel;
#ifdef LIT_IRIDESCENCE
    return mix(ret, iridescence.fresnel, vec3(iridescence.intensity));
#else
    return ret;
#endif    
}

float getFresnelCC(float cosTheta) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    return 0.04 + (1.0 - 0.04) * fresnel;
}
`;
