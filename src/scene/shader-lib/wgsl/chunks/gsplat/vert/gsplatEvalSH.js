export default /* wgsl */`
    #if SH_BANDS == 1
        const SH_COEFFS: i32 = 3;
    #elif SH_BANDS == 2
        const SH_COEFFS: i32 = 8;
    #elif SH_BANDS == 3
        const SH_COEFFS: i32 = 15;
    #elif SH_BANDS == 4
        const SH_COEFFS: i32 = 24;
    #else
        const SH_COEFFS: i32 = 0;
    #endif

    #if SH_BANDS > 0

    const SH_C1: half = half(0.4886025119029199);

    #if SH_BANDS > 1
        const SH_C2_0: half = half(1.0925484305920792);
        const SH_C2_1: half = half(-1.0925484305920792);
        const SH_C2_2: half = half(0.31539156525252005);
        const SH_C2_3: half = half(-1.0925484305920792);
        const SH_C2_4: half = half(0.5462742152960396);
    #endif

    #if SH_BANDS > 2
        const SH_C3_0: half = half(-0.5900435899266435);
        const SH_C3_1: half = half(2.890611442640554);
        const SH_C3_2: half = half(-0.4570457994644658);
        const SH_C3_3: half = half(0.3731763325901154);
        const SH_C3_4: half = half(-0.4570457994644658);
        const SH_C3_5: half = half(1.445305721320277);
        const SH_C3_6: half = half(-0.5900435899266435);
    #endif

    #if SH_BANDS > 3
        const SH_C4_0: half = half(2.5033429417967046);
        const SH_C4_1: half = half(-1.7701307697799304);
        const SH_C4_2: half = half(0.9461746957575601);
        const SH_C4_3: half = half(-0.6690465435572892);
        const SH_C4_4: half = half(0.10578554691520431);
        const SH_C4_5: half = half(-0.6690465435572892);
        const SH_C4_6: half = half(0.47308734787878004);
        const SH_C4_7: half = half(-1.7701307697799304);
        const SH_C4_8: half = half(0.6258357354491761);
    #endif

    // see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
    fn evalSH(sh: ptr<function, array<half3, SH_COEFFS>>, dir: vec3f) -> half3 {
        let d: half3 = half3(dir);

        // 1st degree
        var result: half3 = SH_C1 * (-sh[0] * d.y + sh[1] * d.z - sh[2] * d.x);

        #if SH_BANDS > 1
            // 2nd degree
            let xx: half = d.x * d.x;
            let yy: half = d.y * d.y;
            let zz: half = d.z * d.z;
            let xy: half = d.x * d.y;
            let yz: half = d.y * d.z;
            let xz: half = d.x * d.z;

            result = result + (
                sh[3] * (SH_C2_0 * xy) +
                sh[4] * (SH_C2_1 * yz) +
                sh[5] * (SH_C2_2 * (half(2.0) * zz - xx - yy)) +
                sh[6] * (SH_C2_3 * xz) +
                sh[7] * (SH_C2_4 * (xx - yy))
            );
        #endif

        #if SH_BANDS > 2
            // 3rd degree
            result = result + (
                sh[8]  * (SH_C3_0 * d.y * (half(3.0) * xx - yy)) +
                sh[9]  * (SH_C3_1 * xy * d.z) +
                sh[10] * (SH_C3_2 * d.y * (half(4.0) * zz - xx - yy)) +
                sh[11] * (SH_C3_3 * d.z * (half(2.0) * zz - half(3.0) * xx - half(3.0) * yy)) +
                sh[12] * (SH_C3_4 * d.x * (half(4.0) * zz - xx - yy)) +
                sh[13] * (SH_C3_5 * d.z * (xx - yy)) +
                sh[14] * (SH_C3_6 * d.x * (xx - half(3.0) * yy))
            );
        #endif

        #if SH_BANDS > 3
            // 4th degree (dir is unit length, so the r^2 factors of the basis are dropped)
            result = result + (
                sh[15] * (SH_C4_0 * xy * (xx - yy)) +
                sh[16] * (SH_C4_1 * yz * (half(3.0) * xx - yy)) +
                sh[17] * (SH_C4_2 * xy * (half(7.0) * zz - half(1.0))) +
                sh[18] * (SH_C4_3 * yz * (half(7.0) * zz - half(3.0))) +
                sh[19] * (SH_C4_4 * (zz * (half(35.0) * zz - half(30.0)) + half(3.0))) +
                sh[20] * (SH_C4_5 * xz * (half(7.0) * zz - half(3.0))) +
                sh[21] * (SH_C4_6 * (xx - yy) * (half(7.0) * zz - half(1.0))) +
                sh[22] * (SH_C4_7 * xz * (xx - half(3.0) * yy)) +
                sh[23] * (SH_C4_8 * (xx * (xx - half(3.0) * yy) - yy * (half(3.0) * xx - yy)))
            );
        #endif

        return result;
    }
    #endif
`;
