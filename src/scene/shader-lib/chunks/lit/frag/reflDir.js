export default /* glsl */`
void getReflDir() {
    dReflDirW = normalize(-reflect(dViewDirW, dNormalW));
}
`;
