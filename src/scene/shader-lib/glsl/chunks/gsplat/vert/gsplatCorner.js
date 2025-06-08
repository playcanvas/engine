export default /* glsl */`
uniform vec2 viewport;                  // viewport dimensions
uniform vec4 camera_params;             // 1 / far, far, near, isOrtho

void calcCovarianceOrig(SplatPRS viewPRS, float focal, out vec3 cov0, out vec3 cov1) {
    // M = S * R
    mat3 M = transpose(mat3(
        viewPRS.scale.x * viewPRS.rotation[0],
        viewPRS.scale.y * viewPRS.rotation[1],
        viewPRS.scale.z * viewPRS.rotation[2]
    ));

    vec3 covA = vec3(
        dot(M[0], M[0]),
        dot(M[0], M[1]),
        dot(M[0], M[2])
    );

    vec3 covB = vec3(
        dot(M[1], M[1]),
        dot(M[1], M[2]),
        dot(M[2], M[2])
    );

    mat3 Vrk = mat3(
        covA.x, covA.y, covA.z, 
        covA.y, covB.x, covB.y,
        covA.z, covB.y, covB.z
    );

    vec3 v = camera_params.w == 1.0 ? vec3(0.0, 0.0, 1.0) : viewPRS.position;
    float J1 = focal / v.z;
    vec2 J2 = -J1 / v.z * v.xy;
    mat3 J = mat3(
        J1, 0.0, J2.x, 
        0.0, J1, J2.y, 
        0.0, 0.0, 0.0
    );

    mat3 Jt = mat3(
        J1,   0.0,  0.0,
        0.0,  J1,   0.0,
        J2.x, J2.y, 0.0
    );

    mat3 cov = Jt * Vrk * J;

    cov0 = cov[0];
    cov1 = cov[1];
}

void calcCovariance(SplatPRS viewPRS, float focal, out vec3 cov0, out vec3 cov1) {
    vec3 c0 = viewPRS.scale.x * viewPRS.rotation[0];   // first column of S·R
    vec3 c1 = viewPRS.scale.y * viewPRS.rotation[1];   // second column

    float a00 = dot(c0, c0);   // = covA.x
    float a01 = dot(c0, c1);   // = covA.y
    float a11 = dot(c1, c1);   // = covB.x

    vec3  v      = (camera_params.w == 1.0) ? vec3(0.0, 0.0, 1.0) : viewPRS.position;
    float invZ   = 1.0 / v.z;
    float J1     = focal * invZ;          // ∂x/∂X = ∂y/∂Y = f / Z
    vec2  J2     = -J1 * invZ * v.xy;     // ∂x/∂Z , ∂y/∂Z
    float J1sq   = J1 * J1;

    // cov[0]  (column 0)
    cov0 = vec3(
        J1sq * a00,                                   // (0,0)
        J1sq * a01,                                   // (1,0) = (0,1)
        J1   * (J2.x * a00 + J2.y * a01)              // (2,0)
    );

    // cov[1]  (column 1)
    cov1 = vec3(
        J1sq * a01,                                   // (0,1) = (1,0)
        J1sq * a11,                                   // (1,1)
        J1   * (J2.x * a01 + J2.y * a11)              // (2,1)
    );
}

// calculate the clip-space offset from the center for this gaussian
bool project2D(SplatPRS viewPRS, mat4 proj, out vec2 v0, out vec2 v1, out float aaFactor) {

    vec3 cov0, cov1;
    calcCovariance(viewPRS, viewport.x * proj[0][0], cov0, cov1);

    #if GSPLAT_AA
        // calculate AA factor
        float detOrig = cov0[0] * cov1[1] - cov0[1] * cov0[1];
        float detBlur = (cov0[0] + 0.3) * (cov1[1] + 0.3) - cov0[1] * cov0[1];
        aaFactor = sqrt(max(detOrig / detBlur, 0.0));
    #endif

    float diagonal1 = cov0[0] + 0.3;
    float offDiagonal = cov0[1];
    float diagonal2 = cov1[1] + 0.3;

    float mid = 0.5 * (diagonal1 + diagonal2);
    float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
    float lambda1 = mid + radius;
    float lambda2 = max(mid - radius, 0.1);

    // Use the smaller viewport dimension to limit the kernel size relative to the screen resolution.
    float vmin = min(1024.0, min(viewport.x, viewport.y));

    float l1 = 2.0 * min(sqrt(2.0 * lambda1), vmin);
    float l2 = 2.0 * min(sqrt(2.0 * lambda2), vmin);

    // early-out gaussians smaller than 2 pixels
    if (l1 < 2.0 && l2 < 2.0) {
        return false;
    }

    vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
    v0 = l1 * diagonalVector;
    v1 = l2 * vec2(diagonalVector.y, -diagonalVector.x);

    return true;
}
`;
