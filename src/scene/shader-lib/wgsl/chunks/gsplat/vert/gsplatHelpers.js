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

// Over-unity opacity: a gaussian whose opacity A exceeds 1 - the mass of several gaussians merged by
// decimation, stored by SOG v3 and the PLY opacity_linear column up to 1.5625, the top of the SOG v3
// opacity byte - is drawn with peak alpha 1 as an opaque core of radius u0, a fraction of the quad, with the
// plain gaussian's falloff stretched over the rest of the quad: normExp(((r - u0) / (1 - u0))^2), r = |uv|.
// The quad, culls and extent are therefore the plain gaussian's, and u0 = 0 is the plain gaussian.

// The core radius u0 for opacity A: 0 up to A = 1. The drawn mass relative to a plain gaussian of opacity 1
// is 1 + (a u0^2 + b u0) / G1, where G0 and G1 integrate normExp(c^2) and c normExp(c^2) over c in [0, 1],
// a = 1/2 - G0 + G1 and b = G0 - 2 G1, so the u0 drawing exactly A times that mass is this root
// (u0 <= 0.2625).
fn gsplatPlateauCore(A: f32) -> f32 {
    let t = clamp(A - 1.0, 0.0, 0.5625);
    return sqrt(0.28986718 + 0.62504992 * t) - 0.53839315;
}
`;
