export default /* wgsl */`
// Helper function to extract the RMS size from covariance
fn gsplatExtractSize(covA: vec3f, covB: vec3f) -> f32 {
    let tr = covA.x + covB.x + covB.z;
    return sqrt(max(tr, 0.0) / 3.0);
}

// Helper function to apply uniform scale to covariance
fn gsplatApplyUniformScale(covA: ptr<function, vec3f>, covB: ptr<function, vec3f>, scale: f32) {
    let s2 = scale * scale;
    *covA = *covA * s2;
    *covB = *covB * s2;
}

// Helper function to make splat spherical/round with given size
// Use size = 0.0 to hide the splat
fn gsplatMakeRound(covA: ptr<function, vec3f>, covB: ptr<function, vec3f>, size: f32) {
    let s2 = size * size;
    *covA = vec3f(s2, 0.0, 0.0);
    *covB = vec3f(s2, 0.0, s2);
}
`;
