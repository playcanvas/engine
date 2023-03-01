export default /* glsl */`
// Schlick's approximation
vec3 getFresnel(float cosTheta, LitShaderArguments litShaderArgs) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    float glossSq = litShaderArgs.gloss * litShaderArgs.gloss;
    vec3 ret = litShaderArgs.specularity + (max(vec3(glossSq), litShaderArgs.specularity) - litShaderArgs.specularity) * fresnel;
#ifdef LIT_IRIDESCENCE
    return mix(ret, litShaderArgs.iridescenceFresnel, vec3(litShaderArgs.iridescence));
#else
    return ret;
#endif    
}

float getFresnelCC(float cosTheta) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    return 0.04 + (1.0 - 0.04) * fresnel;
}
`;
