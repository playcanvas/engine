export default /* glsl */`
// Schlick's approximation
vec3 getFresnel(float cosTheta, Frontend frontend) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    float glossSq = frontend.glossiness * frontend.glossiness;
    vec3 ret = frontend.specularity + (max(vec3(glossSq), frontend.specularity) - frontend.specularity) * fresnel;
#ifdef LIT_IRIDESCENCE
    return mix(ret, frontend.iridescenceFresnel, vec3(frontend.iridescence));
#else
    return ret;
#endif    
}

float getFresnelCC(float cosTheta) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    return 0.04 + (1.0 - 0.04) * fresnel;
}
`;
