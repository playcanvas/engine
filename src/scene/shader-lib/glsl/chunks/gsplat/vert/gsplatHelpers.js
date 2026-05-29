export default /* glsl */`
// Make splat spherical by setting uniform scale
// Use size = 0.0 to hide the splat
void gsplatMakeSpherical(inout vec3 scale, float size) {
    scale = vec3(size);
}

// Get RMS size from scale vector
float gsplatGetSizeFromScale(vec3 scale) {
    return sqrt((scale.x * scale.x + scale.y * scale.y + scale.z * scale.z) / 3.0);
}
`;
