export default /* wgsl */`
    #if SH_BANDS == 1
        const SH_COEFFS: i32 = 3;
    #elif SH_BANDS == 2
        const SH_COEFFS: i32 = 8;
    #elif SH_BANDS == 3
        const SH_COEFFS: i32 = 15;
    #else
        const SH_COEFFS: i32 = 0;
    #endif

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
    fn evalSH(sh: ptr<function, array<vec3f, SH_COEFFS>>, dir: vec3f) -> vec3f {
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

        return result;
    }
    #endif
`;
