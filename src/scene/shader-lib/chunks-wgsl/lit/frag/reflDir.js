export default /* wgsl */`
fn getReflDir(worldNormal: vec3f, viewDir: vec3f, gloss: f32, tbn: mat3x3f) {
    dReflDirW = normalize(-reflect(viewDir, worldNormal));
}
`;
