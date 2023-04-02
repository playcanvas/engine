export default /* glsl */`
void occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {
    dSpecularLight *= ao;
    dReflection *= ao;

#ifdef LIT_SHEEN
    sSpecularLight *= ao;
    sReflection *= ao;
#endif
}
`;
