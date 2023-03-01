export default /* glsl */`
#ifdef LIT_CLEARCOAT
void addReflectionCC(float gloss) {
    ccReflection += calcReflection(ccReflDirW, gloss);
}
#endif
`;
