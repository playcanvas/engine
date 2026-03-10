export default /* wgsl */`
fn handleTwoSidedLighting() {
    if (!pcFrontFacing) { dTBN[2] = -dTBN[2]; }
}
`;
