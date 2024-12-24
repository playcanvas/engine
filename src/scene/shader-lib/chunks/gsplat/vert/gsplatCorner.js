export default /* glsl */`
uniform vec2 viewport;                  // viewport dimensions
uniform vec4 camera_params;             // 1 / far, far, near, isOrtho

// calculate the clip-space offset from the center for this gaussian
bool initCorner(SplatSource source, SplatCenter center, out SplatCorner corner) {
    // get covariance
    vec3 covA, covB;
    readCovariance(source, covA, covB);

    mat3 Vrk = mat3(
        covA.x, covA.y, covA.z, 
        covA.y, covB.x, covB.y,
        covA.z, covB.y, covB.z
    );

    float focal = viewport.x * center.projMat00;

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

    float diagonal1 = cov[0][0] + 0.3;
    float offDiagonal = cov[0][1];
    float diagonal2 = cov[1][1] + 0.3;

    float mid = 0.5 * (diagonal1 + diagonal2);
    float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
    float lambda1 = mid + radius;
    float lambda2 = max(mid - radius, 0.1);

    float l1 = 2.0 * min(sqrt(2.0 * lambda1), 1024.0);
    float l2 = 2.0 * min(sqrt(2.0 * lambda2), 1024.0);

    // early-out gaussians smaller than 2 pixels
    if (l1 < 2.0 && l2 < 2.0) {
        return false;
    }

    // perform cull against x/y axes
    if (any(greaterThan(abs(center.proj.xy) - vec2(l1, l2) / viewport * center.proj.w, center.proj.ww))) {
        return false;
    }

    vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
    vec2 v1 = l1 * diagonalVector;
    vec2 v2 = l2 * vec2(diagonalVector.y, -diagonalVector.x);

    corner.offset = (source.cornerUV.x * v1 + source.cornerUV.y * v2) / viewport * center.proj.w;
    corner.uv = source.cornerUV;

    return true;
}
`;
