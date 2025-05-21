export default /* wgsl */`
fn occludeDiffuse(ao: f32) {
    dDiffuseLight = dDiffuseLight * ao;
}
`;
