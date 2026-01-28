export default /* glsl */`
uniform vec4 viewport_size;             // viewport width, height, 1/width, 1/height

// compute 3d covariance from rotation (w,x,y,z format) and scale
void computeCovariance(vec4 rotation, vec3 scale, out vec3 covA, out vec3 covB) {
    mat3 rot = quatToMat3(rotation);

    // M = S * R
    mat3 M = transpose(mat3(
        scale.x * rot[0],
        scale.y * rot[1],
        scale.z * rot[2]
    ));

    covA = vec3(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
    covB = vec3(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));
}

// calculate the clip-space offset from the center for this gaussian
bool initCornerCov(SplatSource source, SplatCenter center, out SplatCorner corner, vec3 covA, vec3 covB) {

    mat3 Vrk = mat3(
        covA.x, covA.y, covA.z, 
        covA.y, covB.x, covB.y,
        covA.z, covB.y, covB.z
    );

    float focal = viewport_size.x * center.projMat00;

    vec3 v = camera_params.w == 1.0 ? vec3(0.0, 0.0, 1.0) : center.view.xyz;
    float J1 = focal / v.z;
    vec2 J2 = -J1 / v.z * v.xy;
    mat3 J = mat3(
        J1, 0.0, J2.x, 
        0.0, J1, J2.y, 
        0.0, 0.0, 0.0
    );

    mat3 W = transpose(mat3(center.modelView));
    mat3 T = W * J;
    mat3 cov = transpose(T) * Vrk * T;

    #if GSPLAT_AA
        // calculate AA factor
        float detOrig = cov[0][0] * cov[1][1] - cov[0][1] * cov[0][1];
        float detBlur = (cov[0][0] + 0.3) * (cov[1][1] + 0.3) - cov[0][1] * cov[0][1];
        corner.aaFactor = sqrt(max(detOrig / detBlur, 0.0));
    #endif

    float diagonal1 = cov[0][0] + 0.3;
    float offDiagonal = cov[0][1];
    float diagonal2 = cov[1][1] + 0.3;

    float mid = 0.5 * (diagonal1 + diagonal2);
    float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
    float lambda1 = mid + radius;
    float lambda2 = max(mid - radius, 0.1);

    // Use the smaller viewport dimension to limit the kernel size relative to the screen resolution.
    float vmin = min(1024.0, min(viewport_size.x, viewport_size.y));

    float l1 = 2.0 * min(sqrt(2.0 * lambda1), vmin);
    float l2 = 2.0 * min(sqrt(2.0 * lambda2), vmin);

    // early-out gaussians smaller than 2 pixels
    if (l1 < 2.0 && l2 < 2.0) {
        return false;
    }

    vec2 c = center.proj.ww * viewport_size.zw;

    // cull against frustum x/y axes
    if (any(greaterThan(abs(center.proj.xy) - vec2(max(l1, l2)) * c, center.proj.ww))) {
        return false;
    }

    vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
    vec2 v1 = l1 * diagonalVector;
    vec2 v2 = l2 * vec2(diagonalVector.y, -diagonalVector.x);

    corner.offset = vec3((source.cornerUV.x * v1 + source.cornerUV.y * v2) * c, 0.0);
    corner.uv = source.cornerUV;

    return true;
}

#if GSPLAT_2DGS
// 2DGS: Compute oriented quad corner in model space
void initCorner2DGS(SplatSource source, vec4 rotation, vec3 scale, out SplatCorner corner) {
    // Scale by 3.0 for 3-sigma coverage
    vec2 localPos = source.cornerUV * vec2(scale.x, scale.y) * 3.0;

    // Rotate the local position using the quaternion
    vec3 v = vec3(localPos, 0.0);
    vec3 t = 2.0 * cross(rotation.xyz, v);
    corner.offset = v + rotation.w * t + cross(rotation.xyz, t);
    corner.uv = source.cornerUV;
}
#endif

// calculate the clip-space offset from the center for this gaussian
bool initCorner(SplatSource source, SplatCenter center, out SplatCorner corner) {
    // Get rotation and scale
    vec4 rotation = getRotation().yzwx;  // Convert (w,x,y,z) to (x,y,z,w)
    vec3 scale = getScale();

    // Hook: modify rotation and scale
    modifySplatRotationScale(center.modelCenterOriginal, center.modelCenterModified, rotation, scale);

    #if GSPLAT_2DGS
        initCorner2DGS(source, rotation, scale, corner);
        return true;
    #else
        // 3DGS: Use covariance-based screen-space projection
        // Compute covariance from (possibly modified) rotation and scale
        vec3 covA, covB;
        computeCovariance(rotation.wxyz, scale, covA, covB);  // Convert back to (w,x,y,z)

        // Existing hook: modify covariance
        modifyCovariance(center.modelCenterOriginal, center.modelCenterModified, covA, covB);

        return initCornerCov(source, center, corner, covA, covB);
    #endif
}
`;
