export default /* glsl */`
// Helper function to extract the RMS size from covariance
float gsplatExtractSize(vec3 covA, vec3 covB) {
    float tr = covA.x + covB.x + covB.z;
    return sqrt(max(tr, 0.0) / 3.0);
}

// Helper function to apply uniform scale to covariance
void gsplatApplyUniformScale(inout vec3 covA, inout vec3 covB, float scale) {
    float s2 = scale * scale;
    covA *= s2;
    covB *= s2;
}

// Helper function to make splat spherical/round with given size
// Use size = 0.0 to hide the splat
void gsplatMakeRound(inout vec3 covA, inout vec3 covB, float size) {
    float s2 = size * size;
    covA = vec3(s2, 0.0, 0.0);
    covB = vec3(s2, 0.0, s2);
}
`;
