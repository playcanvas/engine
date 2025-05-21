export default /* wgsl */`
fn getViewDir() {
    dViewDirW = normalize(uniform.view_position - vPositionW);
}
`;
