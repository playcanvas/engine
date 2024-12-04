export default /* glsl */`

struct SplatState {
    uint order;         // render order
    uint id;            // splat id
    ivec2 uv;           // splat uv
    vec2 cornerUV;      // corner coordinates for this vertex of the gaussian (-1, -1)..(1, 1)
};

struct ProjectedState {
    mat4 modelView;     // model-view matrix
    vec3 centerCam;     // center in camera space
    vec4 centerProj;    // center in clip space

    vec2 cornerOffset;  // corner offset in clip space
    vec4 cornerProj;    // corner position in clip space
    vec2 cornerUV;      // corner uv
};

#if SH_BANDS > 0
    #if SH_BANDS == 1
        #define SH_COEFFS 3
    #elif SH_BANDS == 2
        #define SH_COEFFS 8
    #elif SH_BANDS == 3
        #define SH_COEFFS 15
    #endif
#endif

#if GSPLAT_COMPRESSED_DATA == true
    #include "gsplatCompressedDataVS"
    #include "gsplatCompressedSHVS"
#else
    #include "gsplatDataVS"
    #include "gsplatColorVS"
    #include "gsplatSHVS"
#endif

#include "gsplatOutputPS"

uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;
uniform vec2 viewport;                  // viewport dimensions
uniform vec4 camera_params;             // 1 / far, far, near, isOrtho

// initialize the splat state structure
bool initState(out SplatState state) {
    // calculate splat order
    state.order = vertex_id_attrib + uint(vertex_position.z);

    // return if out of range (since the last block of splats may be partially full)
    if (state.order >= tex_params.x) {
        return false;
    }

    ivec2 orderUV = ivec2(state.order % tex_params.y, state.order / tex_params.y);

    // read splat id
    state.id = texelFetch(splatOrder, orderUV, 0).r;

    // map id to uv
    state.uv = ivec2(state.id % tex_params.y, state.id / tex_params.y);

    // get the corner
    state.cornerUV = vertex_position.xy;

    return true;
}

// calculate 2d covariance vectors
bool projectCenter(SplatState state, vec3 center, out ProjectedState projState) {
    // project center to screen space
    mat4 model_view = matrix_view * matrix_model;
    vec4 centerCam = model_view * vec4(center, 1.0);
    vec4 centerProj = matrix_projection * centerCam;
    if (centerProj.z < -centerProj.w) {
        return false;
    }

    // get covariance
    vec3 covA, covB;
    readCovariance(state, covA, covB);

    mat3 Vrk = mat3(
        covA.x, covA.y, covA.z, 
        covA.y, covB.x, covB.y,
        covA.z, covB.y, covB.z
    );

    float focal = viewport.x * matrix_projection[0][0];

    vec3 v = camera_params.w == 1.0 ? vec3(0.0, 0.0, 1.0) : centerCam.xyz;
    float J1 = focal / v.z;
    vec2 J2 = -J1 / v.z * v.xy;
    mat3 J = mat3(
        J1, 0.0, J2.x, 
        0.0, J1, J2.y, 
        0.0, 0.0, 0.0
    );

    mat3 W = transpose(mat3(model_view));
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

    // perform clipping test against x/y
    if (any(greaterThan(abs(centerProj.xy) - vec2(l1, l2) / viewport * centerProj.w * 0.5, centerProj.ww))) {
        return false;
    }

    vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
    vec2 v1 = l1 * diagonalVector;
    vec2 v2 = l2 * vec2(diagonalVector.y, -diagonalVector.x);

    projState.modelView = model_view;
    projState.centerCam = centerCam.xyz;
    projState.centerProj = centerProj;
    projState.cornerOffset = (state.cornerUV.x * v1 + state.cornerUV.y * v2) / viewport * centerProj.w;
    projState.cornerProj = centerProj + vec4(projState.cornerOffset, 0.0, 0.0);
    projState.cornerUV = state.cornerUV;

    return true;
}

// modify the projected gaussian so it excludes regions with alpha
// less than 1/255
void applyClipping(inout ProjectedState projState, float alpha) {
    float clip = min(1.0, sqrt(-log(1.0 / 255.0 / alpha)) / 2.0);
    projState.cornerProj.xy -= projState.cornerOffset * (1.0 - clip);
    projState.cornerUV *= clip;
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
vec3 evalSH(in SplatState state, in ProjectedState projState) {

    // read sh coefficients
    vec3 sh[SH_COEFFS];
    readSHData(state, sh);

    // calculate the model-space view direction
    vec3 dir = normalize(projState.centerCam * mat3(projState.modelView));

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
        sh[3] * (SH_C2_0 * xy) *  +
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

    return result;
}
#endif
`;
