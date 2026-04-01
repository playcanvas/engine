export const computeGsplatCommonSource = /* wgsl */`

#include "halfTypesCS"

const TILE_SIZE: u32 = 16u;

fn quatToMat3(r: half4) -> half3x3 {
    let r2: half4 = r + r;
    let x: half   = r2.x * r.w;
    let y: half4  = r2.y * r;
    let z: half4  = r2.z * r;
    let w: half   = r2.w * r.w;

    return half3x3(
        half(1.0) - z.z - w,  y.z + x,              y.w - z.x,
        y.z - x,              half(1.0) - y.y - w,   z.w + y.x,
        y.w + z.x,            z.w - y.x,             half(1.0) - y.y - z.z
    );
}

struct SplatCov2D {
    screen: vec2f,
    a: f32,
    b: f32,
    c: f32,
    viewDepth: f32,
    valid: bool,
}

fn computeSplatCov(
    worldCenter: vec3f,
    rotation: half4,
    scale: half3,
    viewMatrix: mat4x4f,
    viewProj: mat4x4f,
    focal: f32,
    viewportWidth: f32,
    viewportHeight: f32,
    nearClip: f32,
    farClip: f32,
    opacity: f32,
    minPixelSize: f32,
    isOrtho: u32,
    alphaClip: f32
) -> SplatCov2D {
    var result: SplatCov2D;
    result.valid = false;

    let viewCenter = (viewMatrix * vec4f(worldCenter, 1.0)).xyz;

    if (viewCenter.z > 0.0) {
        return result;
    }

    let clip = viewProj * vec4f(worldCenter, 1.0);
    let ndc = clip.xy / clip.w;
    let screen = vec2f(
        (ndc.x * 0.5 + 0.5) * viewportWidth,
        (ndc.y * 0.5 + 0.5) * viewportHeight
    );

    let rot: half3x3 = quatToMat3(rotation);
    let s: vec3f = vec3f(scale);
    let M: mat3x3f = transpose(mat3x3f(
        s.x * vec3f(rot[0]),
        s.y * vec3f(rot[1]),
        s.z * vec3f(rot[2])
    ));

    let ortho = isOrtho == 1u;
    let v = select(viewCenter.xyz, vec3f(0.0, 0.0, 1.0), ortho);
    let vz = select(min(v.z, -0.001), v.z, ortho);
    let J1 = focal / vz;
    let J2 = -J1 / vz * v.xy;

    // Compute TT columns directly without materializing full J and W matrices.
    // Original code:
    //   let J = mat3x3f(vec3f(J1, 0.0, J2.x), vec3f(0.0, J1, J2.y), vec3f(0.0, 0.0, 0.0));
    //   let W = transpose(mat3x3f(viewMatrix[0].xyz, viewMatrix[1].xyz, viewMatrix[2].xyz));
    //   let TT = W * J;
    let w0 = vec3f(viewMatrix[0].x, viewMatrix[1].x, viewMatrix[2].x);
    let w1 = vec3f(viewMatrix[0].y, viewMatrix[1].y, viewMatrix[2].y);
    let w2 = vec3f(viewMatrix[0].z, viewMatrix[1].z, viewMatrix[2].z);
    let tt0 = J1 * w0 + J2.x * w2;
    let tt1 = J1 * w1 + J2.y * w2;

    // Fused covariance: cov = TT^T * Vrk * TT = TT^T * (M^T * M) * TT = (M * TT)^T * (M * TT).
    // Compute B = M * TT then cov = B^T * B, avoiding the intermediate Vrk (mat3x3f) matrix.
    // Original code:
    //   let covA = vec3f(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
    //   let covB = vec3f(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));
    //   let Vrk = mat3x3f(vec3f(covA.x, covA.y, covA.z), ...);
    //   let cov = transpose(TT) * Vrk * TT;
    let b0 = M * tt0;
    let b1 = M * tt1;

    let a = dot(b0, b0) + 0.3;
    let b = dot(b0, b1);
    let c = dot(b1, b1) + 0.3;

    let det = a * c - b * b;
    if (det <= 0.0) {
        return result;
    }

    // Distance-adaptive contribution culling inspired by cullByTotalInk from gsm-renderer
    // https://github.com/AugmentedPercception/gsm-renderer
    // Rejects splats whose total visual contribution (opacity * ellipse area) is negligible.
    // The threshold increases with depth so nearby quality is preserved while distant
    // low-impact splats are culled, acting as a built-in LOD mechanism.
    let totalContribution = opacity * 6.283185 * sqrt(det);
    // Distance from camera within which contribution culling is not applied
    let effectiveCullDistance = farClip * 0.02;
    let depthNorm = 1.0 - pow(saturate((effectiveCullDistance + viewCenter.z) / (effectiveCullDistance - nearClip)), 2.0);
    if (totalContribution < depthNorm * 2.0) {
        return result;
    }

    // Opacity-aware radius tightening based on FlashGS
    // https://github.com/InternLandMark/FlashGS
    // The fixed factor 8.0 corresponds to power = -4.0 (exp(-4) ≈ 0.018).
    // For low-opacity splats, pixels become invisible (alpha < alphaClip) at a closer
    // distance. We solve for the power where opacity * exp(power) = alphaClip,
    // giving radiusFactor = min(8.0, 2.0 * ln(opacity / alphaClip)). This shrinks
    // the effective radius for low-opacity splats, reducing tile assignments.
    let radiusFactor = computeRadiusFactor(half(opacity), alphaClip);

    let vmin = min(1024.0, min(viewportWidth, viewportHeight));
    let maxRadius = 2.0 * vmin;
    let radiusXUncapped = sqrt(2.0 * a);
    let radiusYUncapped = sqrt(2.0 * c);
    let radiusX = min(radiusXUncapped, maxRadius);
    let radiusY = min(radiusYUncapped, maxRadius);

    if (max(radiusX, radiusY) < minPixelSize) {
        return result;
    }

    // Frustum cull: reject splats entirely off-screen
    if (screen.x + radiusX < 0.0 || screen.x - radiusX > viewportWidth ||
        screen.y + radiusY < 0.0 || screen.y - radiusY > viewportHeight) {
        return result;
    }

    // When the projected extent exceeds the radius cap, rescale the covariance
    // so the Gaussian reaches its cutoff at the capped boundary. Without this,
    // the Gaussian is still opaque at the boundary, creating hard rectangular
    // edges. This matches the quad renderer's implicit UV renormalization.
    let capScale = max(1.0, max(radiusXUncapped, radiusYUncapped) / maxRadius);
    let invCapScale2 = 1.0 / (capScale * capScale);

    result.screen = screen;
    let scaledCov = vec3f(a, b, c) * invCapScale2;
    result.a = scaledCov.x;
    result.b = scaledCov.y;
    result.c = scaledCov.z;
    result.viewDepth = -viewCenter.z;
    result.valid = true;
    return result;
}
`;
