export default /* wgsl */`
uniform viewport_size: vec4f;             // viewport width, height, 1/width, 1/height

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

    corner.offset = (source.cornerUV.x * v1 + source.cornerUV.y * v2) * c;
    corner.uv = source.cornerUV;

    return true;
}

// calculate the clip-space offset from the center for this gaussian
fn initCorner(source: ptr<function, SplatSource>, center: ptr<function, SplatCenter>, corner: ptr<function, SplatCorner>) -> bool {
    var covA: vec3f;
    var covB: vec3f;
    readCovariance(source, &covA, &covB);
    modifyCovariance(center.modelCenterOriginal, center.modelCenterModified, &covA, &covB);
    return initCornerCov(source, center, corner, covA, covB);
}
`;
