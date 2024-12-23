export default /* glsl */`
const float maxCascades = 4.0;

// shadow matrix for selected cascade
mat4 cascadeShadowMat;

// function which selects a shadow projection matrix based on cascade distances 
void getShadowCascadeMatrix(mat4 shadowMatrixPalette[4], vec4 shadowCascadeDistances, float shadowCascadeCount) {

    // depth in 0 .. far plane range
    float depth = 1.0 / gl_FragCoord.w;

    // 1.0 if depth >= distance, 0.0 otherwise
    vec4 comparisons = step(shadowCascadeDistances, vec4(depth));

    // sum is the index
    float cascadeIndex = dot(comparisons, vec4(1.0));

    // limit to actual number of used cascades
    cascadeIndex = min(cascadeIndex, shadowCascadeCount - 1.0);

    // pick shadow matrix
    cascadeShadowMat = shadowMatrixPalette[int(cascadeIndex)];
}

void fadeShadow(vec4 shadowCascadeDistances) {                  
    // if the pixel is past the shadow distance, remove shadow
    // this enforces straight line instead of corner of shadow which moves when camera rotates  
    float depth = 1.0 / gl_FragCoord.w;
    if (depth > shadowCascadeDistances.w) {
        dShadowCoord.z = -9999999.0;
    }
}
`;
