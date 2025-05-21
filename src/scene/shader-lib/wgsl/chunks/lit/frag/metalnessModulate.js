export default /* glsl */`

fn getSpecularModulate(specularity: vec3f, albedo: vec3f, metalness: f32, f0: f32) -> vec3f {
    let dielectricF0: vec3f = f0 * specularity;
    return mix(dielectricF0, albedo, metalness);
}

fn getAlbedoModulate(albedo: vec3f, metalness: f32) -> vec3f {
    return albedo * (1.0 - metalness);
}
`;
