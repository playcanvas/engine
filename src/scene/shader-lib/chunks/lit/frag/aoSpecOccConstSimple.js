export default /* glsl */`
void occludeSpecular() {
    dSpecularLight *= dAo;
    dReflection *= dAo;

#ifdef LIT_SHEEN
    sSpecularLight *= dAo;
    sReflection *= dAo;
#endif

}
`;
