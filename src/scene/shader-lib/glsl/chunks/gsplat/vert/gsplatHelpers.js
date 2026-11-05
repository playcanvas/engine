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

// Screen-space low-pass filter added to the projected 2D covariance. The covariance is built with
// focal = viewport size * projection scale, which is twice the focal length in pixels, so it is in
// (half pixel)^2 units and the 0.3 px^2 filter of 3DGS is 1.2 here.
const float GSPLAT_LOWPASS = 1.2;

// Filter the size and contribution culls measure the footprint with: 0.075 px^2 (0.3 here). With the
// full filter every splat is at least 3.1 px wide, so the default culls would stop firing on distant
// content and multiply its fill cost. This keeps culling the splats it did before the filter was
// corrected to 0.3 px^2.
const float GSPLAT_CULL_LOWPASS = 0.3;

// Returns true when a splat with the screen covariance [a b; b c] (in the units above) is drawn
// smaller than size pixels. The drawn ellipse reaches 2 * sqrt(2) standard deviations, a major-axis
// diameter of 2 * sqrt(2 * lambda1) pixels, so the test is lambda1 < size^2 / 8, done without square
// roots: t exceeds lambda1 exactly when it lies above the mean of the eigenvalues and the
// characteristic polynomial (t - a)(t - c) - b^2 is positive there.
bool gsplatFootprintSmallerThan(float a, float b, float c, float size) {
    float t = size * size * 0.125;
    return t > 0.5 * (a + c) && (t - a) * (t - c) > b * b;
}

// Over-unity opacity (see GSplatParams#compensation): a gaussian whose opacity A exceeds 1 (up to 1.5625,
// the top of the SOG v3 opacity byte) is drawn with peak alpha 1 and the plateau profile
// exp(-D/2 * max(0, r * e - (D - 1))^2), r in sigma: an opaque core joined smoothly to a gaussian edge,
// squeezed by e = gsplatPlateauExtent(D) so that it reaches the plain gaussian's exp(-4) floor at the same
// 2 sqrt(2) sigma. The quad, culls and extent are therefore the plain gaussian's; only the trim and the
// fragment depend on D. D is the shape that carries exactly A: I(D) / e^2 = A, with the unsqueezed mass
// I(D) = (D-1)^2/2 + 1/D + (D-1)/2 sqrt(2 pi / D). D = 1 is the plain gaussian.

// The shape D for opacity A: 1 up to A = 1, then fitted in t = A - 1 to within 2.3e-4 (D <= 1.84).
float gsplatPlateauShape(float A) {
    float t = clamp(A - 1.0, 0.0, 0.5625);
    float s = sqrt(t);
    return 1.0 + t * (1.885151 + s * (-0.4472323 + s * (-0.6204184 + 0.6875631 * s)));
}

// The squeeze e: the unsqueezed profile's extent, (D - 1) + 2 sqrt(2 / D) sigma, over the plain gaussian's
// 2 sqrt(2) sigma (0.98 to 1.03 for D <= 1.84; 1 at D = 1).
float gsplatPlateauExtent(float D) {
    return (D - 1.0) * 0.35355339 + inversesqrt(D);
}

// The trim: the fraction of the quad at which a profile of peak alpha falls to alphaClip,
// ((D - 1) + sqrt(2 ln(alpha / alphaClip) / D)) / e sigma over 2 sqrt(2) sigma, capped at 1.
float gsplatPlateauClip(float D, float alpha, float alphaClip) {
    float edge = (D - 1.0) * 0.35355339 + 0.5 * sqrt(max(0.0, log(alpha / alphaClip)) / D);
    return min(1.0, edge / gsplatPlateauExtent(D));
}
`;
