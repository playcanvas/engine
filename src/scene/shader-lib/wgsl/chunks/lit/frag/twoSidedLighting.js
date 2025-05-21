export default /* wgsl */`
uniform twoSidedLightingNegScaleFactor: f32;

fn handleTwoSidedLighting() {
    dTBN[2] = dTBN[2] * select(-uniform.twoSidedLightingNegScaleFactor, uniform.twoSidedLightingNegScaleFactor, pcFrontFacing);
}
`;
