export default /* glsl */`
    #if SH_BANDS == 1
        #define SH_COEFFS 3
    #elif SH_BANDS == 2
        #define SH_COEFFS 8
    #elif SH_BANDS == 3
        #define SH_COEFFS 15
    #elif SH_BANDS == 4
        #define SH_COEFFS 24
    #else
        #define SH_COEFFS 0
    #endif

    #if SH_BANDS > 0

    const float SH_C1 = 0.4886025119029199f;

    #if SH_BANDS > 1
        const float SH_C2_0 = 1.0925484305920792f;
        const float SH_C2_1 = -1.0925484305920792f;
        const float SH_C2_2 = 0.31539156525252005f;
        const float SH_C2_3 = -1.0925484305920792f;
        const float SH_C2_4 = 0.5462742152960396f;
    #endif

    #if SH_BANDS > 2
        const float SH_C3_0 = -0.5900435899266435f;
        const float SH_C3_1 = 2.890611442640554f;
        const float SH_C3_2 = -0.4570457994644658f;
        const float SH_C3_3 = 0.3731763325901154f;
        const float SH_C3_4 = -0.4570457994644658f;
        const float SH_C3_5 = 1.445305721320277f;
        const float SH_C3_6 = -0.5900435899266435f;
    #endif

    #if SH_BANDS > 3
        const float SH_C4_0 = 2.5033429417967046f;
        const float SH_C4_1 = -1.7701307697799304f;
        const float SH_C4_2 = 0.9461746957575601f;
        const float SH_C4_3 = -0.6690465435572892f;
        const float SH_C4_4 = 0.10578554691520431f;
        const float SH_C4_5 = -0.6690465435572892f;
        const float SH_C4_6 = 0.47308734787878004f;
        const float SH_C4_7 = -1.7701307697799304f;
        const float SH_C4_8 = 0.6258357354491761f;
    #endif

    // see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
    vec3 evalSH(in vec3 sh[SH_COEFFS], in vec3 dir) {
        float x = dir.x;
        float y = dir.y;
        float z = dir.z;

        // 1st degree
        vec3 result = SH_C1 * (-sh[0] * y + sh[1] * z - sh[2] * x);

        #if SH_BANDS > 1
            // 2nd degree
            float xx = x * x;
            float yy = y * y;
            float zz = z * z;
            float xy = x * y;
            float yz = y * z;
            float xz = x * z;

            result +=
                sh[3] * (SH_C2_0 * xy) +
                sh[4] * (SH_C2_1 * yz) +
                sh[5] * (SH_C2_2 * (2.0 * zz - xx - yy)) +
                sh[6] * (SH_C2_3 * xz) +
                sh[7] * (SH_C2_4 * (xx - yy));
        #endif

        #if SH_BANDS > 2
            // 3rd degree
            result +=
                sh[8]  * (SH_C3_0 * y * (3.0 * xx - yy)) +
                sh[9]  * (SH_C3_1 * xy * z) +
                sh[10] * (SH_C3_2 * y * (4.0 * zz - xx - yy)) +
                sh[11] * (SH_C3_3 * z * (2.0 * zz - 3.0 * xx - 3.0 * yy)) +
                sh[12] * (SH_C3_4 * x * (4.0 * zz - xx - yy)) +
                sh[13] * (SH_C3_5 * z * (xx - yy)) +
                sh[14] * (SH_C3_6 * x * (xx - 3.0 * yy));
        #endif

        #if SH_BANDS > 3
            // 4th degree (dir is unit length, so the r^2 factors of the basis are dropped)
            result +=
                sh[15] * (SH_C4_0 * xy * (xx - yy)) +
                sh[16] * (SH_C4_1 * yz * (3.0 * xx - yy)) +
                sh[17] * (SH_C4_2 * xy * (7.0 * zz - 1.0)) +
                sh[18] * (SH_C4_3 * yz * (7.0 * zz - 3.0)) +
                sh[19] * (SH_C4_4 * (zz * (35.0 * zz - 30.0) + 3.0)) +
                sh[20] * (SH_C4_5 * xz * (7.0 * zz - 3.0)) +
                sh[21] * (SH_C4_6 * (xx - yy) * (7.0 * zz - 1.0)) +
                sh[22] * (SH_C4_7 * xz * (xx - 3.0 * yy)) +
                sh[23] * (SH_C4_8 * (xx * (xx - 3.0 * yy) - yy * (3.0 * xx - yy)));
        #endif

        return result;
    }
    #endif
`;
