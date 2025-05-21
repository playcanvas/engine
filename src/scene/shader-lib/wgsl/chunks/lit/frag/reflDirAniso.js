export default /* wgsl */`
fn getReflDir(worldNormal: vec3f, viewDir: vec3f, gloss: f32, tbn: mat3x3f) {
    let roughness: f32 = sqrt(1.0 - min(gloss, 1.0));

    let direction: vec2f = dAnisotropyRotation;
    let anisotropicT: vec3f = normalize(tbn * vec3f(direction, 0.0));
    let anisotropicB: vec3f = normalize(cross(tbn[2], anisotropicT));

    let anisotropy: f32 = dAnisotropy;
    let anisotropicDirection: vec3f = anisotropicB;
    let anisotropicTangent: vec3f = cross(anisotropicDirection, viewDir);
    let anisotropicNormal: vec3f = cross(anisotropicTangent, anisotropicDirection);
    let bendFactor: f32 = 1.0 - anisotropy * (1.0 - roughness);
    let bendFactor4: f32 = bendFactor * bendFactor * bendFactor * bendFactor;
    let bentNormal: vec3f = normalize(mix(normalize(anisotropicNormal), normalize(worldNormal), bendFactor4));
    dReflDirW = reflect(-viewDir, bentNormal);
}`;
