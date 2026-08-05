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

        return result;
    }
    #endif
`;
