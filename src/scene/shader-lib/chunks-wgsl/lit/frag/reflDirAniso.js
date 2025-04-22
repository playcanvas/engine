export default /* wgsl */`
fn getReflDir(worldNormal: vec3f, viewDir: vec3f, gloss: f32, tbn: mat3x3f) {
    let roughness: f32 = sqrt(1.0 - min(gloss, 1.0));
    let anisotropy: f32 = uniform.material_anisotropy * roughness;
    let anisotropicDirection: vec3f = select(tbn[0], tbn[1], anisotropy >= 0.0);
    let anisotropicTangent: vec3f = cross(anisotropicDirection, viewDir);
    let anisotropicNormal: vec3f = cross(anisotropicTangent, anisotropicDirection);
    let bentNormal: vec3f = normalize(mix(normalize(worldNormal), normalize(anisotropicNormal), anisotropy));
    dReflDirW = reflect(-viewDir, bentNormal);
}`;
