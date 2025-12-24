export default /* glsl */`
// Schlick's approximation (glTF 2.0 compliant)
// F = F0 + (F90 - F0) * (1 - V·H)^5, where F90 = 1.0
vec3 getFresnel(
        float cosTheta, 
        float gloss, 
        vec3 specularity
#if defined(LIT_IRIDESCENCE)
        , vec3 iridescenceFresnel, 
        float iridescenceIntensity
#endif
    ) {
    float fresnel = pow(1.0 - saturate(cosTheta), 5.0);
    vec3 ret = specularity + (vec3(1.0) - specularity) * fresnel;

#if defined(LIT_IRIDESCENCE)
    return mix(ret, iridescenceFresnel, iridescenceIntensity);
#else
    return ret;
#endif    
}

float getFresnelCC(float cosTheta) {
    float fresnel = pow(1.0 - saturate(cosTheta), 5.0);
    return 0.04 + (1.0 - 0.04) * fresnel;
}
`;
