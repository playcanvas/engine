export default /* wgsl */`
uniform viewport_size: vec4f;             // viewport width, height, 1/width, 1/height

// compute 3d covariance from rotation (w,x,y,z format) and scale
fn computeCovariance(rotation: vec4f, scale: vec3f, covA_ptr: ptr<function, vec3f>, covB_ptr: ptr<function, vec3f>) {
    let rot = quatToMat3(rotation);

    // M = S * R
    let M = transpose(mat3x3f(
        scale.x * rot[0],
        scale.y * rot[1],
        scale.z * rot[2]
    ));

    *covA_ptr = vec3f(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
    *covB_ptr = vec3f(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));
}

// calculate the clip-space offset from the center for this gaussian
fn initCornerCov(source: ptr<function, SplatSource>, center: ptr<function, SplatCenter>, corner: ptr<function, SplatCorner>, covA: vec3f, covB: vec3f) -> bool {

    let Vrk = mat3x3f(
        vec3f(covA.x, covA.y, covA.z),
        vec3f(covA.y, covB.x, covB.y),
        vec3f(covA.z, covB.y, covB.z)
    );

    let focal = uniform.viewport_size.x * center.projMat00;

    let v = select(center.view.xyz, vec3f(0.0, 0.0, 1.0), uniform.camera_params.w == 1.0);
    let J1 = focal / v.z;
    let J2 = -J1 / v.z * v.xy;
    let J = mat3x3f(
        vec3f(J1, 0.0, J2.x),
        vec3f(0.0, J1, J2.y),
        vec3f(0.0, 0.0, 0.0)
    );

    let W = transpose(mat3x3f(center.modelView[0].xyz, center.modelView[1].xyz, center.modelView[2].xyz));
    let T = W * J;
    let cov = transpose(T) * Vrk * T;

    #if GSPLAT_AA
        // calculate AA factor
        let detOrig = cov[0][0] * cov[1][1] - cov[0][1] * cov[1][0]; // Using [0][1] * [1][0] as matrix might not be perfectly symmetric numerically
        let detBlur = (cov[0][0] + 0.3) * (cov[1][1] + 0.3) - cov[0][1] * cov[1][0];
        corner.aaFactor = sqrt(detOrig / detBlur);
    #endif

    let diagonal1 = cov[0][0] + 0.3;
    let offDiagonal = cov[0][1];
    let diagonal2 = cov[1][1] + 0.3;

    let mid = 0.5 * (diagonal1 + diagonal2);
    let radius = length(vec2f((diagonal1 - diagonal2) / 2.0, offDiagonal));
    let lambda1 = mid + radius;
    let lambda2 = max(mid - radius, 0.1);

    // Use the smaller viewport dimension to limit the kernel size relative to the screen resolution.
    let vmin = min(1024.0, min(uniform.viewport_size.x, uniform.viewport_size.y));

    let l1 = 2.0 * min(sqrt(2.0 * lambda1), vmin);
    let l2 = 2.0 * min(sqrt(2.0 * lambda2), vmin);

    // early-out gaussians smaller than 2 pixels
    if (l1 < 2.0 && l2 < 2.0) {
        return false;
    }

    let c = center.proj.ww * uniform.viewport_size.zw;

    // cull against frustum x/y axes
    if (any((abs(center.proj.xy) - vec2f(max(l1, l2)) * c) > center.proj.ww)) {
        return false;
    }

    let diagonalVector = normalize(vec2f(offDiagonal, lambda1 - diagonal1));
    let v1 = l1 * diagonalVector;
    let v2 = l2 * vec2f(diagonalVector.y, -diagonalVector.x); // Swizzle

    corner.offset = vec3f((source.cornerUV.x * v1 + source.cornerUV.y * v2) * c, 0.0);
    corner.uv = source.cornerUV;

    return true;
}

#if GSPLAT_2DGS
// 2DGS: Compute oriented quad corner in model space
fn initCorner2DGS(source: ptr<function, SplatSource>, rotation: vec4f, scale: vec3f, corner: ptr<function, SplatCorner>) {
    // Scale by 3.0 for 3-sigma coverage
    let localPos: vec2f = source.cornerUV * vec2f(scale.x, scale.y) * 3.0;

    // Rotate the local position using the quaternion
    let v: vec3f = vec3f(localPos, 0.0);
    let t: vec3f = 2.0 * cross(rotation.xyz, v);
    corner.offset = v + rotation.w * t + cross(rotation.xyz, t);
    corner.uv = source.cornerUV;
}
#endif

// calculate the clip-space offset from the center for this gaussian
fn initCorner(source: ptr<function, SplatSource>, center: ptr<function, SplatCenter>, corner: ptr<function, SplatCorner>) -> bool {
    // Get rotation and scale
    var rotation: vec4f = getRotation().yzwx;  // Convert (w,x,y,z) to (x,y,z,w)
    var scale: vec3f = getScale();

    // Hook: modify rotation and scale
    modifySplatRotationScale(center.modelCenterOriginal, center.modelCenterModified, &rotation, &scale);

    #if GSPLAT_2DGS
        initCorner2DGS(source, rotation, scale, corner);
        return true;
    #else
        // 3DGS: Use covariance-based screen-space projection
        // Compute covariance from (possibly modified) rotation and scale
        var covA: vec3f;
        var covB: vec3f;
        computeCovariance(rotation.wxyz, scale, &covA, &covB);  // Convert back to (w,x,y,z)

        // Existing hook: modify covariance
        modifyCovariance(center.modelCenterOriginal, center.modelCenterModified, &covA, &covB);

        return initCornerCov(source, center, corner, covA, covB);
    #endif
}
`;
