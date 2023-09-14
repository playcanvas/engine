export default /* glsl */`
void getReflDir(vec3 worldNormal, vec3 viewDir, float gloss, mat3 tbn) {
    dReflDirW = normalize(-reflect(viewDir, worldNormal));
}
`;
