export default /* wgsl */`

// stores the source UV and order of the splat
struct SplatSource {
    order: u32,         // render order
    id: u32,            // splat id
    uv: vec2<i32>,      // splat uv
    cornerUV: vec2f,    // corner coordinates for this vertex of the gaussian (-1, -1)..(1, 1)
}

// stores the camera and clip space position of the gaussian center
struct SplatCenter {
    view: vec3f,          // center in view space
    proj: vec4f,          // center in clip space
    modelView: mat4x4f,   // model-view matrix
    projMat00: f32,       // elememt [0][0] of the projection matrix
}

// stores the offset from center for the current gaussian
struct SplatCorner {
    offset: vec2f,        // corner offset from center in clip space
    uv: vec2f,            // corner uv
    #if GSPLAT_AA
        aaFactor: f32, // for scenes generated with antialiasing
    #endif
}

fn quatToMat3(R: vec4<f32>) -> mat3x3<f32> {
    let R2: vec4<f32> = R + R;
    let X: f32       = R2.x * R.w;
    let Y: vec4<f32> = R2.y * R;
    let Z: vec4<f32> = R2.z * R;
    let W: f32       = R2.w * R.w;

    return mat3x3<f32>(
        1.0 - Z.z - W,  Y.z + X,      Y.w - Z.x,
        Y.z - X,        1.0 - Y.y - W, Z.w + Y.x,
        Y.w + Z.x,      Z.w - Y.x,     1.0 - Y.y - Z.z
    );
}

#if SH_BANDS == 1
    const SH_COEFFS: i32 = 3;
#elif SH_BANDS == 2
    const SH_COEFFS: i32 = 8;
#elif SH_BANDS == 3
    const SH_COEFFS: i32 = 15;
#else
    const SH_COEFFS: i32 = 0;
#endif

#if GSPLAT_COMPRESSED_DATA
    #include "gsplatCompressedDataVS"
    #if SH_BANDS > 0
        #include "gsplatCompressedSHVS"
    #endif
#elif GSPLAT_SOGS_DATA
    #include "gsplatSogsDataVS"
    #include "gsplatSogsColorVS"
    #if SH_BANDS > 0
        #include "gsplatSogsSHVS"
    #endif
#else
    #include "gsplatDataVS"
    #include "gsplatColorVS"
    #if SH_BANDS > 0
        #include "gsplatSHVS"
    #endif
#endif

#include "gsplatSourceVS"
#include "gsplatCenterVS"
#include "gsplatCornerVS"
#include "gsplatOutputVS"

// modify the gaussian corner so it excludes gaussian regions with alpha less than 1/255
fn clipCorner(corner: ptr<function, SplatCorner>, alpha: f32) {
    let clip: f32 = min(1.0, sqrt(-log(1.0 / (255.0 * alpha))) / 2.0);
    corner.offset = corner.offset * clip;
    corner.uv = corner.uv * clip;
}

// spherical Harmonics

#if SH_BANDS > 0
    const SH_C1: f32 = 0.4886025119029199;

    #if SH_BANDS > 1
        const SH_C2_0: f32 = 1.0925484305920792;
        const SH_C2_1: f32 = -1.0925484305920792;
        const SH_C2_2: f32 = 0.31539156525252005;
        const SH_C2_3: f32 = -1.0925484305920792;
        const SH_C2_4: f32 = 0.5462742152960396;
    #endif

    #if SH_BANDS > 2
        const SH_C3_0: f32 = -0.5900435899266435;
        const SH_C3_1: f32 = 2.890611442640554;
        const SH_C3_2: f32 = -0.4570457994644658;
        const SH_C3_3: f32 = 0.3731763325901154;
        const SH_C3_4: f32 = -0.4570457994644658;
        const SH_C3_5: f32 = 1.445305721320277;
        const SH_C3_6: f32 = -0.5900435899266435;
    #endif

    // see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
    fn evalSH(source: ptr<function, SplatSource>, dir: vec3f) -> vec3f {

        var sh: array<vec3f, SH_COEFFS>;

        var scale: f32;
        readSHData(source, &sh, &scale);

        let x = dir.x;
        let y = dir.y;
        let z = dir.z;

        // 1st degree
        var result = SH_C1 * (-sh[0] * y + sh[1] * z - sh[2] * x);

        #if SH_BANDS > 1
            // 2nd degree
            let xx = x * x;
            let yy = y * y;
            let zz = z * z;
            let xy = x * y;
            let yz = y * z;
            let xz = x * z;

            result = result + (
                sh[3] * (SH_C2_0 * xy) +
                sh[4] * (SH_C2_1 * yz) +
                sh[5] * (SH_C2_2 * (2.0 * zz - xx - yy)) +
                sh[6] * (SH_C2_3 * xz) +
                sh[7] * (SH_C2_4 * (xx - yy))
            );
        #endif

        #if SH_BANDS > 2
            // 3rd degree
            result = result + (
                sh[8]  * (SH_C3_0 * y * (3.0 * xx - yy)) +
                sh[9]  * (SH_C3_1 * xy * z) +
                sh[10] * (SH_C3_2 * y * (4.0 * zz - xx - yy)) +
                sh[11] * (SH_C3_3 * z * (2.0 * zz - 3.0 * xx - 3.0 * yy)) +
                sh[12] * (SH_C3_4 * x * (4.0 * zz - xx - yy)) +
                sh[13] * (SH_C3_5 * z * (xx - yy)) +
                sh[14] * (SH_C3_6 * x * (xx - 3.0 * yy))
            );
        #endif

        return result * scale;
    }
#endif
`;
