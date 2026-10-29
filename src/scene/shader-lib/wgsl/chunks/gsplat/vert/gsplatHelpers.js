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

// A splat whose screen covariance is [a b; b c] (in pixels², dilation included) is drawn as an
// ellipse reaching 2 * sqrt(2) standard deviations: its semi-axes are 2 * sqrt(2 * lambda),
// lambda being the eigenvalues of the covariance. Returns whether the major axis is shorter than
// size, i.e. 2 * sqrt(2 * lambda1) < size with lambda1 = 0.5 * (a + c) + length(vec2f(0.5 * (a - c), b)).
// Equivalent to computing that and comparing, without square roots: the inequality is
// lambda1 < size^2 / 8, and a value t exceeds lambda1 exactly when it lies above the midpoint of
// the eigenvalues and the characteristic polynomial (t - a)(t - c) - b^2 is positive there.
fn gsplatFootprintSmallerThan(a: f32, b: f32, c: f32, size: f32) -> bool {
    let t = size * size * 0.125;
    return t > 0.5 * (a + c) && (t - a) * (t - c) > b * b;
}
`;
