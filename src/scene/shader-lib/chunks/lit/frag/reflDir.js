export default /* glsl */`
void getReflDir(vec3 worldNormal, float gloss) {
    dReflDirW = normalize(-reflect(dViewDirW, worldNormal));
}
`;
