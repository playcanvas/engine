export default /* glsl */`

fn getSpecularModulate(specularity: vec3f, albedo: vec3f, metalness: f32, f0: f32, specularityFactor: f32) -> vec3f {
    // Apply specularityFactor to dielectric F0 only. For metals (metalness=1), F0 is the albedo
    // and should not be affected by specularityFactor per the KHR_materials_specular glTF spec.
    let dielectricF0: vec3f = f0 * specularity * specularityFactor;
    return mix(dielectricF0, albedo, metalness);
}

fn getAlbedoModulate(albedo: vec3f, metalness: f32) -> vec3f {
    return albedo * (1.0 - metalness);
}
`;
