// Modifies the ambient lighting of the lit shader, and occludes the reflections of the environment.
// By default it changes neither. Internal: the probe volume of the extras replaces it.
export default /* wgsl */`

// returns the ambient light of a surface, from the ambient light of the scene at it
fn modifyAmbient(ambient: vec3f, worldNormal: vec3f) -> vec3f {
    return ambient;
}

// returns the scale of the reflections of the environment, called after modifyAmbient
fn getReflectionOcclusion() -> f32 {
    return 1.0;
}
`;
