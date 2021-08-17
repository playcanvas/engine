const float maxCascades = 4.0;

// shadow matrix for selected cascade
mat4 cascadeShadowMat;

// function which selects a shadow projection matrix based on cascade distances 
void getShadowCascadeMatrix(mat4 shadowMatrixPalette[4], float shadowCascadeDistances[4], float shadowCascadeCount) {

    // depth in 0 .. far plane range
    float depth = 1.0 / gl_FragCoord.w;

    // find cascade index based on the depth (loop as there is no per component vec compare operator in webgl)
    float cascadeIndex = 0.0;
    for (float i = 0.0; i < maxCascades; i++) {
        if (depth < shadowCascadeDistances[int(i)]) {
            cascadeIndex = i;
            break;
        }
    }

    // limit to actual number of used cascades
    cascadeIndex = min(cascadeIndex, shadowCascadeCount - 1.0);

    // pick shadow matrix
    #ifdef GL2
        cascadeShadowMat = shadowMatrixPalette[int(cascadeIndex)];
    #else
        // webgl 1 does not allow non-cost index array lookup
        if (cascadeIndex == 0.0) {
            cascadeShadowMat = shadowMatrixPalette[0];
        }
        else if (cascadeIndex == 1.0) {
            cascadeShadowMat = shadowMatrixPalette[1];
        }
        else if (cascadeIndex == 2.0) {
            cascadeShadowMat = shadowMatrixPalette[2];
        }
        else {
            cascadeShadowMat = shadowMatrixPalette[3];
        }
    #endif
}

void fadeShadow(float shadowCascadeDistances[4]) {                  

    // if the pixel is past the shadow distance, remove shadow
    // this enforces straight line instead of corner of shadow which moves when camera rotates  
    float depth = 1.0 / gl_FragCoord.w;
    if (depth > shadowCascadeDistances[int(maxCascades - 1.0)]) {
        dShadowCoord.z = -9999999.0;
    }
}
