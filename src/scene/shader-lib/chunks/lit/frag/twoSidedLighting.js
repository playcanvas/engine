export default /* glsl */`
uniform float twoSidedLightingNegScaleFactor;
void handleTwoSidedLighting() {
    float factor = (gl_FrontFacing ? 1.0 : -1.0) * twoSidedLightingNegScaleFactor;
    // if (factor != 1.0) {
        dTBN *= factor;
    // }
}
`;
