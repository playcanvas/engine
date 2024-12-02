export default /* glsl */`
attribute vec3 vertex_position;         // xy: cornerUV, z: render order offset
attribute uint vertex_id_attrib;        // render order base

uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;

uniform vec2 viewport;                  // viewport dimensions
uniform uvec2 tex_params;               // num splats, texture width

uniform highp usampler2D splatOrder;
uniform highp usampler2D transformA;
uniform highp sampler2D transformB;
uniform mediump sampler2D splatColor;

// work values
uint tAw;

// read the model-space center of the gaussian
bool readCenter(out SplatState state) {
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

    // read transform data
    uvec4 tA = texelFetch(transformA, state.uv, 0);
    tAw = tA.w;

    state.cornerUV = vertex_position.xy;
    state.center = uintBitsToFloat(tA.xyz);

    return true;
}

vec4 readColor(in SplatState state) {
    return texelFetch(splatColor, state.uv, 0);
}

// sample covariance vectors
void getCovariance(in SplatState state, out vec3 covA, out vec3 covB) {
    vec4 tB = texelFetch(transformB, state.uv, 0);
    vec2 tC = unpackHalf2x16(tAw);
    covA = tB.xyz;
    covB = vec3(tC.x, tC.y, tB.w);
}

// calculate screen space gaussian vertex position
bool projectCenter(inout SplatState state) {
    // project center to screen space
    mat4 model_view = matrix_view * matrix_model;
    vec4 centerCam = model_view * vec4(state.center, 1.0);
    vec4 centerProj = matrix_projection * centerCam;
    if (centerProj.z < -centerProj.w) {
        return false;
    }

    mat3 W = transpose(mat3(model_view));

    // get covariance
    vec3 covA, covB;
    getCovariance(state, covA, covB);

    mat3 Vrk = mat3(
        covA.x, covA.y, covA.z, 
        covA.y, covB.x, covB.y,
        covA.z, covB.y, covB.z
    );

    float focal = viewport.x * matrix_projection[0][0];

    float J1 = focal / centerCam.z;
    vec2 J2 = -J1 / centerCam.z * centerCam.xy;
    mat3 J = mat3(
        J1, 0.0, J2.x, 
        0.0, J1, J2.y, 
        0.0, 0.0, 0.0
    );

    mat3 T = W * J;
    mat3 cov = transpose(T) * Vrk * T;

    float diagonal1 = cov[0][0] + 0.3;
    float offDiagonal = cov[0][1];
    float diagonal2 = cov[1][1] + 0.3;

    float mid = 0.5 * (diagonal1 + diagonal2);
    float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
    float lambda1 = mid + radius;
    float lambda2 = max(mid - radius, 0.1);
    vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));

    vec2 v1 = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
    vec2 v2 = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);

    if (dot(v1, v1) < 4.0 && dot(v2, v2) < 4.0) {
        return false;
    }

    state.centerCam = centerCam.xyz / centerCam.w;
    state.centerProj = centerProj;
    state.cornerOffset = (state.cornerUV.x * v1 + state.cornerUV.y * v2) / viewport * state.centerProj.w;

    return true;
}

// Spherical Harmonics

#if SH_BANDS > 0

#define SH_C1 0.4886025119029199f
#define SH_C2_0 1.0925484305920792f
#define SH_C2_1 -1.0925484305920792f
#define SH_C2_2 0.31539156525252005f
#define SH_C2_3 -1.0925484305920792f
#define SH_C2_4 0.5462742152960396f
#define SH_C3_0 -0.5900435899266435f
#define SH_C3_1 2.890611442640554f
#define SH_C3_2 -0.4570457994644658f
#define SH_C3_3 0.3731763325901154f
#define SH_C3_4 -0.4570457994644658f
#define SH_C3_5 1.445305721320277f
#define SH_C3_6 -0.5900435899266435f

    uniform highp usampler2D splatSH_1to3;
#if SH_BANDS > 1
    uniform highp usampler2D splatSH_4to7;
    uniform highp usampler2D splatSH_8to11;
#if SH_BANDS > 2
    uniform highp usampler2D splatSH_12to15;
#endif
#endif

vec3 unpack111011(uint bits) {
    return vec3(
        float(bits >> 21u) / 2047.0,
        float((bits >> 11u) & 0x3ffu) / 1023.0,
        float(bits & 0x7ffu) / 2047.0
    );
}

// fetch quantized spherical harmonic coefficients
void fetchScale(in uvec4 t, out float scale, out vec3 a, out vec3 b, out vec3 c) {
    scale = uintBitsToFloat(t.x);
    a = unpack111011(t.y) * 2.0 - 1.0;
    b = unpack111011(t.z) * 2.0 - 1.0;
    c = unpack111011(t.w) * 2.0 - 1.0;
}

// fetch quantized spherical harmonic coefficients
void fetch(in uvec4 t, out vec3 a, out vec3 b, out vec3 c, out vec3 d) {
    a = unpack111011(t.x) * 2.0 - 1.0;
    b = unpack111011(t.y) * 2.0 - 1.0;
    c = unpack111011(t.z) * 2.0 - 1.0;
    d = unpack111011(t.w) * 2.0 - 1.0;
}

// see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
vec3 evalSH(in SplatState state) {
    vec3 result = vec3(0.0);

    // transform camera-space view vector to model space
    vec3 dir = normalize(state.centerCam * mat3(matrix_view) * mat3(matrix_model));

    // 1st degree
    float x = dir.x;
    float y = dir.y;
    float z = dir.z;

    float scale;
    vec3 sh1, sh2, sh3;
    fetchScale(texelFetch(splatSH_1to3, state.uv, 0), scale, sh1, sh2, sh3);
    result += SH_C1 * (-sh1 * y + sh2 * z - sh3 * x);

#if SH_BANDS > 1
    // 2nd degree
    float xx = x * x;
    float yy = y * y;
    float zz = z * z;
    float xy = x * y;
    float yz = y * z;
    float xz = x * z;

    vec3 sh4, sh5, sh6, sh7;
    vec3 sh8, sh9, sh10, sh11;
    fetch(texelFetch(splatSH_4to7, state.uv, 0), sh4, sh5, sh6, sh7);
    fetch(texelFetch(splatSH_8to11, state.uv, 0), sh8, sh9, sh10, sh11);
    result +=
        sh4 * (SH_C2_0 * xy) *  +
        sh5 * (SH_C2_1 * yz) +
        sh6 * (SH_C2_2 * (2.0 * zz - xx - yy)) +
        sh7 * (SH_C2_3 * xz) +
        sh8 * (SH_C2_4 * (xx - yy));

#if SH_BANDS > 2
    // 3rd degree
    vec3 sh12, sh13, sh14, sh15;
    fetch(texelFetch(splatSH_12to15, state.uv, 0), sh12, sh13, sh14, sh15);
    result +=
        sh9  * (SH_C3_0 * y * (3.0 * xx - yy)) +
        sh10 * (SH_C3_1 * xy * z) +
        sh11 * (SH_C3_2 * y * (4.0 * zz - xx - yy)) +
        sh12 * (SH_C3_3 * z * (2.0 * zz - 3.0 * xx - 3.0 * yy)) +
        sh13 * (SH_C3_4 * x * (4.0 * zz - xx - yy)) +
        sh14 * (SH_C3_5 * z * (xx - yy)) +
        sh15 * (SH_C3_6 * x * (xx - 3.0 * yy));
#endif
#endif
    result *= scale;

    return result;
}
#endif
`;
