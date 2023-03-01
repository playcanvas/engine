export default /* glsl */`
void occludeSpecular(float ao) {
    dSpecularLight *= ao;
    dReflection *= ao;

#ifdef LIT_SHEEN
    sSpecularLight *= ao;
    sReflection *= ao;
#endif
}
`;
