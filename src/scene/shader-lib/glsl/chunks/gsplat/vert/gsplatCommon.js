export default /* glsl */`

// stores the source UV and order of the splat
struct SplatSource {
    uint order;         // render order
    uint id;            // splat id
    ivec2 uv;           // splat uv
    vec2 cornerUV;      // corner coordinates for this vertex of the gaussian (-1, -1)..(1, 1)
};

// stores the camera and clip space position of the gaussian center
struct SplatCenter {
    vec3 view;          // center in view space
    vec4 proj;          // center in clip space
    mat4 modelView;     // model-view matrix
    float projMat00;    // element [0][0] of the projection matrix
};

mat3 quatToMat3(vec4 R) {
    vec4 R2 = R + R;
    float X = R2.x * R.w;
    vec4 Y  = R2.y * R;
    vec4 Z  = R2.z * R;
    float W = R2.w * R.w;

    return mat3(
        1.0 - Z.z - W,
              Y.z + X,
              Y.w - Z.x,
              Y.z - X,
        1.0 - Y.y - W,
              Z.w + Y.x,
              Y.w + Z.x,
              Z.w - Y.x,
        1.0 - Y.y - Z.z
    );
}

// stores the offset from center for the current gaussian
struct SplatCorner {
    vec2 offset;        // corner offset from center in clip space
    vec2 uv;            // corner uv
    #if GSPLAT_AA
        float aaFactor; // for scenes generated with antialiasing
    #endif
};

#if SH_BANDS == 1
    #define SH_COEFFS 3
#elif SH_BANDS == 2
    #define SH_COEFFS 8
#elif SH_BANDS == 3
    #define SH_COEFFS 15
#else
    #define SH_COEFFS 0
#endif

#if GSPLAT_COMPRESSED_DATA == true
    #include "gsplatCompressedDataVS"
    #if SH_COEFFS > 0
        #include "gsplatCompressedSHVS"
    #endif
#elif GSPLAT_SOGS_DATA == true
    #include "gsplatSogsDataVS"
    #include "gsplatSogsColorVS"
    #if SH_COEFFS > 0
        #include "gsplatSogsSHVS"
    #endif
#else
    #include "gsplatDataVS"
    #include "gsplatColorVS"
    #if SH_COEFFS > 0
        #include "gsplatSHVS"
    #endif
#endif

#include "gsplatSourceVS"
#include "gsplatCenterVS"
#include "gsplatCornerVS"
#include "gsplatOutputVS"

// modify the gaussian corner so it excludes gaussian regions with alpha less than 1/255
void clipCorner(inout SplatCorner corner, float alpha) {
    float clip = min(1.0, sqrt(-log(1.0 / 255.0 / alpha)) / 2.0);
    corner.offset *= clip;
    corner.uv *= clip;
}

// spherical Harmonics

#if SH_BANDS > 0

    #define SH_C1 0.4886025119029199f

    #if SH_BANDS > 1
        #define SH_C2_0 1.0925484305920792f
        #define SH_C2_1 -1.0925484305920792f
        #define SH_C2_2 0.31539156525252005f
        #define SH_C2_3 -1.0925484305920792f
        #define SH_C2_4 0.5462742152960396f
    #endif

    #if SH_BANDS > 2
        #define SH_C3_0 -0.5900435899266435f
        #define SH_C3_1 2.890611442640554f
        #define SH_C3_2 -0.4570457994644658f
        #define SH_C3_3 0.3731763325901154f
        #define SH_C3_4 -0.4570457994644658f
        #define SH_C3_5 1.445305721320277f
        #define SH_C3_6 -0.5900435899266435f
    #endif

    // see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
    vec3 evalSH(in SplatSource source, in vec3 dir) {

        vec3 sh[SH_COEFFS];

        // read sh coefficients
        float scale;
        readSHData(source, sh, scale);

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

        return result * scale;
    }
#endif
`;
