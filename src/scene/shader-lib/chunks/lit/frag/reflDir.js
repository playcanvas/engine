export default /* glsl */`
void getReflDir(Frontend frontend) {
    dReflDirW = normalize(-reflect(dViewDirW, frontend.worldNormal));
}
`;
