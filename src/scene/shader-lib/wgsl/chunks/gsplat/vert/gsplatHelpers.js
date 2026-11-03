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

// Screen-space low-pass filter added to the projected 2D covariance. The covariance is built with
// focal = viewport size * projection scale, which is twice the focal length in pixels, so it is in
// (half pixel)^2 units and the 0.3 px^2 filter of 3DGS is 1.2 here.
const GSPLAT_LOWPASS: f32 = 1.2;

// Filter the size and contribution culls measure the footprint with: 0.075 px^2 (0.3 here). With the
// full filter every splat is at least 3.1 px wide, so the default culls would stop firing on distant
// content and multiply its fill cost. This keeps culling the splats it did before the filter was
// corrected to 0.3 px^2.
const GSPLAT_CULL_LOWPASS: f32 = 0.3;

// Returns true when a splat with the screen covariance [a b; b c] (in the units above) is drawn
// smaller than size pixels. The drawn ellipse reaches 2 * sqrt(2) standard deviations, a major-axis
// diameter of 2 * sqrt(2 * lambda1) pixels, so the test is lambda1 < size^2 / 8, done without square
// roots: t exceeds lambda1 exactly when it lies above the mean of the eigenvalues and the
// characteristic polynomial (t - a)(t - c) - b^2 is positive there.
fn gsplatFootprintSmallerThan(a: f32, b: f32, c: f32, size: f32) -> bool {
    let t = size * size * 0.125;
    return t > 0.5 * (a + c) && (t - a) * (t - c) > b * b;
}
`;
