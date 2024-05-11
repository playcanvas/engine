export default /* glsl */`
uniform float twoSidedLightingNegScaleFactor;
void handleTwoSidedLighting() {
    dTBN[2] *= gl_FrontFacing ? twoSidedLightingNegScaleFactor : -twoSidedLightingNegScaleFactor;
}
`;
