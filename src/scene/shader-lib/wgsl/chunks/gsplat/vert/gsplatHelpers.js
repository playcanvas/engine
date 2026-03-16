export default /* wgsl */`
// Make splat spherical by setting uniform scale
// Use size = 0.0 to hide the splat
fn gsplatMakeSpherical(scale: ptr<function, vec3f>, size: f32) {
    *scale = vec3f(size);
}

// Get RMS size from scale vector
fn gsplatGetSizeFromScale(scale: vec3f) -> f32 {
    return sqrt((scale.x * scale.x + scale.y * scale.y + scale.z * scale.z) / 3.0);
}
`;
