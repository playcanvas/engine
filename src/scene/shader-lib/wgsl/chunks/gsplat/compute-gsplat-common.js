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
    radius: vec2f,
    radiusFactor: f32,
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
    isOrtho: u32
) -> SplatCov2D {
    var result: SplatCov2D;
    result.valid = false;

    let viewCenter = (viewMatrix * vec4f(worldCenter, 1.0)).xyz;

    if (viewCenter.z > -nearClip) {
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

    let covA = vec3f(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
    let covB = vec3f(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));

    let Vrk = mat3x3f(
        vec3f(covA.x, covA.y, covA.z),
        vec3f(covA.y, covB.x, covB.y),
        vec3f(covA.z, covB.y, covB.z)
    );

    let ortho = isOrtho == 1u;
    let v = select(viewCenter.xyz, vec3f(0.0, 0.0, 1.0), ortho);
    let vz = select(min(v.z, -nearClip), v.z, ortho);
    let J1 = focal / vz;
    let J2 = -J1 / vz * v.xy;
    let J = mat3x3f(
        vec3f(J1, 0.0, J2.x),
        vec3f(0.0, J1, J2.y),
        vec3f(0.0, 0.0, 0.0)
    );

    let W = transpose(mat3x3f(
        viewMatrix[0].xyz,
        viewMatrix[1].xyz,
        viewMatrix[2].xyz
    ));
    let TT = W * J;
    let cov = transpose(TT) * Vrk * TT;

    let a = cov[0][0] + 0.3;
    let b = cov[0][1];
    let c = cov[1][1] + 0.3;

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
    // For low-opacity splats, pixels become invisible (alpha < 1/255) at a closer
    // distance. We solve for the power where opacity * exp(power) = 1/255,
    // giving radiusFactor = min(8.0, 2.0 * ln(255 * opacity)). This shrinks
    // the effective radius for low-opacity splats, reducing tile assignments.
    let radiusFactor = computeRadiusFactor(half(opacity));

    let vmin = min(1024.0, min(viewportWidth, viewportHeight));
    let radiusX = min(sqrt(2.0 * a), 2.0 * vmin);
    let radiusY = min(sqrt(2.0 * c), 2.0 * vmin);

    if (max(radiusX, radiusY) < minPixelSize) {
        return result;
    }

    // Frustum cull: reject splats entirely off-screen
    if (screen.x + radiusX < 0.0 || screen.x - radiusX > viewportWidth ||
        screen.y + radiusY < 0.0 || screen.y - radiusY > viewportHeight) {
        return result;
    }

    result.screen = screen;
    result.a = a;
    result.b = b;
    result.c = c;
    result.radius = vec2f(radiusX, radiusY);
    result.radiusFactor = radiusFactor;
    result.valid = true;
    return result;
}
`;
