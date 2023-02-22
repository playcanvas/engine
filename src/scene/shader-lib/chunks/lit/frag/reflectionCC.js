export default /* glsl */`
#ifdef LIT_CLEARCOAT
void addReflectionCC(Frontend frontend) {
    ccReflection += calcReflection(ccReflDirW, frontend.ccGlossiness);
}
#endif
`;
