export default /* glsl */`
void getReflDir(vec3 worldNormal, vec3 viewDir, float gloss) {
    dReflDirW = normalize(-reflect(viewDir, worldNormal));
}
`;
