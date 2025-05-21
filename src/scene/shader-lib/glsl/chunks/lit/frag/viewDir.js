export default /* glsl */`
void getViewDir() {
    dViewDirW = normalize(view_position - vPositionW);
}
`;
