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
    alphaClip: f32,
    minContribution: f32,
    #ifdef GSPLAT_FISHEYE
        fisheye_k: f32,
        fisheye_inv_k: f32,
        fisheye_projMat00: f32,
        fisheye_projMat11: f32,
    #endif
) -> SplatCov2D {
    var result: SplatCov2D;
    result.valid = false;

    let viewCenter = (viewMatrix * vec4f(worldCenter, 1.0)).xyz;

    #ifdef GSPLAT_FISHEYE

        // Generalized fisheye: g(θ) = k·tan(θ/k)
        let fv = viewCenter;
        let r_xy = length(fv.xy);
        let neg_z = -fv.z;
        let theta = atan2(r_xy, neg_z);

        // Cull near the singularity at θ = k·π/2, and at camera origin
        let maxTheta = min(fisheye_k * 1.5707963, 3.13);
        if (theta > maxTheta - 0.01 || dot(fv, fv) < 0.0001) {
            return result;
        }

        let tk = theta * fisheye_inv_k;
        let sin_tk = sin(tk);
        let cos_tk = cos(tk);
        let g_theta = fisheye_k * sin_tk / cos_tk;
        let fisheye_s = select(select(0.0, 1.0 / neg_z, neg_z > 0.0), g_theta / r_xy, r_xy > 1e-4);

        let fndc = vec2f(fisheye_projMat00 * fisheye_s * fv.x, fisheye_projMat11 * fisheye_s * fv.y);
        let screen = vec2f(
            (fndc.x * 0.5 + 0.5) * viewportWidth,
            (fndc.y * 0.5 + 0.5) * viewportHeight
        );

    #else

        if (viewCenter.z > 0.0) {
            return result;
        }

        let clip = viewProj * vec4f(worldCenter, 1.0);
        let ndc = clip.xy / clip.w;
        let screen = vec2f(
            (ndc.x * 0.5 + 0.5) * viewportWidth,
            (ndc.y * 0.5 + 0.5) * viewportHeight
        );

    #endif

    let rot: half3x3 = quatToMat3(rotation);
    let s: vec3f = vec3f(scale);
    let M: mat3x3f = transpose(mat3x3f(
        s.x * vec3f(rot[0]),
        s.y * vec3f(rot[1]),
        s.z * vec3f(rot[2])
    ));

    let w0 = vec3f(viewMatrix[0].x, viewMatrix[1].x, viewMatrix[2].x);
    let w1 = vec3f(viewMatrix[0].y, viewMatrix[1].y, viewMatrix[2].y);
    let w2 = vec3f(viewMatrix[0].z, viewMatrix[1].z, viewMatrix[2].z);

    #ifdef GSPLAT_FISHEYE

        // Fisheye Jacobian for g(θ) = k·tan(θ/k)
        let fisheyeFocal = viewportWidth * fisheye_projMat00;
        let g_prime = 1.0 / (cos_tk * cos_tk);
        let d2 = dot(fv, fv);
        let r_sq = max(r_xy * r_xy, 1e-8);
        let K_coeff = select(0.0, (g_prime * neg_z / d2 - fisheye_s) / r_sq, r_xy > 1e-4);

        let Jxx = fisheyeFocal * (fisheye_s + K_coeff * fv.x * fv.x);
        let Jxy = fisheyeFocal * K_coeff * fv.x * fv.y;
        let Jyy = fisheyeFocal * (fisheye_s + K_coeff * fv.y * fv.y);
        let Jzx = fisheyeFocal * g_prime * fv.x / d2;
        let Jzy = fisheyeFocal * g_prime * fv.y / d2;

        let tt0 = Jxx * w0 + Jxy * w1 + Jzx * w2;
        let tt1 = Jxy * w0 + Jyy * w1 + Jzy * w2;

    #else

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
        let tt0 = J1 * w0 + J2.x * w2;
        let tt1 = J1 * w1 + J2.y * w2;

    #endif

    // Fused covariance: cov = TT^T * Vrk * TT = TT^T * (M^T * M) * TT = (M * TT)^T * (M * TT).
    // Compute B = M * TT then cov = B^T * B, avoiding the intermediate Vrk (mat3x3f) matrix.
    let b0 = M * tt0;
    let b1 = M * tt1;

    let a = dot(b0, b0) + 0.3;
    let b = dot(b0, b1);
    let c = dot(b1, b1) + 0.3;

    let det = a * c - b * b;
    if (det <= 0.0) {
        return result;
    }

    // Rejects splats whose total visual contribution (opacity * projected area) is
    // negligible. Near the camera, projected areas are large so contributions naturally
    // exceed the threshold; at distance, areas shrink and low-impact splats are culled.
    let totalContribution = opacity * 6.283185 * sqrt(det);
    if (totalContribution < minContribution) {
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
    let maxRadius = vmin;
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
    #ifdef GSPLAT_FISHEYE
        result.viewDepth = sqrt(d2);
    #else
        result.viewDepth = -viewCenter.z;
    #endif
    result.valid = true;
    return result;
}
`;
