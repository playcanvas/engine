export default /* glsl */`
void handleTwoSidedLighting() {
    if (!gl_FrontFacing) dTBN[2] = -dTBN[2];
}
`;
