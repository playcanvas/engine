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

// A splat whose screen covariance is [a b; b c] (in pixels², dilation included) is drawn as an
// ellipse reaching 2 * sqrt(2) standard deviations: its semi-axes are 2 * sqrt(2 * lambda),
// lambda being the eigenvalues of the covariance. Returns whether the major axis is shorter than
// size, i.e. 2 * sqrt(2 * lambda1) < size with lambda1 = 0.5 * (a + c) + length(vec2(0.5 * (a - c), b)).
// Equivalent to computing that and comparing, without square roots: the inequality is
// lambda1 < size^2 / 8, and a value t exceeds lambda1 exactly when it lies above the midpoint of
// the eigenvalues and the characteristic polynomial (t - a)(t - c) - b^2 is positive there.
bool gsplatFootprintSmallerThan(float a, float b, float c, float size) {
    float t = size * size * 0.125;
    return t > 0.5 * (a + c) && (t - a) * (t - c) > b * b;
}
`;
