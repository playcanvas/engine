export default /* glsl */`
uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;

uniform vec2 viewport;                  // viewport dimensions
uniform uvec3 tex_params;               // num splats, packed width, chunked width

uniform highp usampler2D splatOrder;
uniform highp usampler2D packedTexture;
uniform highp sampler2D chunkTexture;

attribute vec3 vertex_position;
attribute uint vertex_id_attrib;

struct SplatState {
    uint order;         // render order
    uint id;            // splat id
    ivec2 uv;           // splat uv

    vec2 corner;        // corner coordinates for this vertex of the gaussian (-2, -2)..(2, 2)
    vec3 center;        // model space center

    vec3 centerCam;     // center in camera space
    vec4 centerProj;    // center in screen space
    vec2 cornerOffset;  // corner offset in screen space
};

// work values
vec4 chunkDataA;    // x: min_x, y: min_y, z: min_z, w: max_x
vec4 chunkDataB;    // x: max_y, y: max_z, z: scale_min_x, w: scale_min_y
vec4 chunkDataC;    // x: scale_min_z, y: scale_max_x, z: scale_max_y, w: scale_max_z
vec4 chunkDataD;    // x: min_r, y: min_g, z: min_b, w: max_r
vec4 chunkDataE;    // x: max_g, y: max_b, z: unused, w: unused
uvec4 packedData;   // x: position bits, y: rotation bits, z: scale bits, w: color bits

vec3 unpack111011(uint bits) {
    return vec3(
        float(bits >> 21u) / 2047.0,
        float((bits >> 11u) & 0x3ffu) / 1023.0,
        float(bits & 0x7ffu) / 2047.0
    );
}

// calculate the current splat index and uvs
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

    // calculate chunkUV
    uint chunkId = state.id / 256u;
    ivec2 chunkUV = ivec2((chunkId % tex_params.z) * 5u, chunkId / tex_params.z);

    // read chunk and packed compressed data
    chunkDataA = texelFetch(chunkTexture, chunkUV, 0);
    chunkDataB = texelFetch(chunkTexture, chunkUV + ivec2(1, 0), 0);
    chunkDataC = texelFetch(chunkTexture, chunkUV + ivec2(2, 0), 0);
    chunkDataD = texelFetch(chunkTexture, chunkUV + ivec2(3, 0), 0);
    chunkDataE = texelFetch(chunkTexture, chunkUV + ivec2(4, 0), 0);
    packedData = texelFetch(packedTexture, state.uv, 0);

    state.center = mix(chunkDataA.xyz, vec3(chunkDataA.w, chunkDataB.xy), unpack111011(packedData.x));
    state.corner = vertex_position.xy;

    return true;
}

vec4 unpack8888(uint bits) {
    return vec4(
        float(bits >> 24u) / 255.0,
        float((bits >> 16u) & 0xffu) / 255.0,
        float((bits >> 8u) & 0xffu) / 255.0,
        float(bits & 0xffu) / 255.0
    );
}

float norm = 1.0 / (sqrt(2.0) * 0.5);

vec4 unpackRotation(uint bits) {
    float a = (float((bits >> 20u) & 0x3ffu) / 1023.0 - 0.5) * norm;
    float b = (float((bits >> 10u) & 0x3ffu) / 1023.0 - 0.5) * norm;
    float c = (float(bits & 0x3ffu) / 1023.0 - 0.5) * norm;
    float m = sqrt(1.0 - (a * a + b * b + c * c));

    uint mode = bits >> 30u;
    if (mode == 0u) return vec4(m, a, b, c);
    if (mode == 1u) return vec4(a, m, b, c);
    if (mode == 2u) return vec4(a, b, m, c);
    return vec4(a, b, c, m);
}

vec4 getRotation() {
    return unpackRotation(packedData.y);
}

vec3 getScale() {
    return exp(mix(vec3(chunkDataB.zw, chunkDataC.x), chunkDataC.yzw, unpack111011(packedData.z)));
}

vec4 readColor(in SplatState state) {
    vec4 r = unpack8888(packedData.w);
    return vec4(mix(chunkDataD.xyz, vec3(chunkDataD.w, chunkDataE.xy), r.rgb), r.w);
}

mat3 quatToMat3(vec4 R) {
    float x = R.x;
    float y = R.y;
    float z = R.z;
    float w = R.w;
    return mat3(
        1.0 - 2.0 * (z * z + w * w),
              2.0 * (y * z + x * w),
              2.0 * (y * w - x * z),
              2.0 * (y * z - x * w),
        1.0 - 2.0 * (y * y + w * w),
              2.0 * (z * w + x * y),
              2.0 * (y * w + x * z),
              2.0 * (z * w - x * y),
        1.0 - 2.0 * (y * y + z * z)
    );
}

// Given a rotation matrix and scale vector, compute 3d covariance A and B
void getCovariance(out vec3 covA, out vec3 covB) {
    mat3 rot = quatToMat3(getRotation());
    vec3 scale = getScale();

    // M = S * R
    mat3 M = transpose(mat3(
        scale.x * rot[0],
        scale.y * rot[1],
        scale.z * rot[2]
    ));

    covA = vec3(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
    covB = vec3(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));
}

// calculate 2d covariance vectors
bool projectCenter(inout SplatState state) {
    // project center to screen space
    mat4 model_view = matrix_view * matrix_model;
    vec4 centerCam = model_view * vec4(state.center, 1.0);
    vec4 centerProj = matrix_projection * centerCam;
    if (centerProj.z < -centerProj.w) {
        return false;
    }

    // get covariance
    vec3 covA, covB;
    getCovariance(covA, covB);

    mat3 W = transpose(mat3(model_view));

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
    state.cornerOffset = (state.corner.x * v1 + state.corner.y * v2) / viewport * state.centerProj.w;

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

uniform highp usampler2D shTexture0;
uniform highp usampler2D shTexture1;
uniform highp usampler2D shTexture2;

vec4 sunpack8888(in uint bits) {
    return vec4((uvec4(bits) >> uvec4(0u, 8u, 16u, 24u)) & 0xffu) * (8.0 / 255.0) - 4.0;
}

void readSHData(in SplatState state, out vec3 sh[15]) {
    // read the sh coefficients
    uvec4 shData0 = texelFetch(shTexture0, state.uv, 0);
    uvec4 shData1 = texelFetch(shTexture1, state.uv, 0);
    uvec4 shData2 = texelFetch(shTexture2, state.uv, 0);

    vec4 r0 = sunpack8888(shData0.x);
    vec4 r1 = sunpack8888(shData0.y);
    vec4 r2 = sunpack8888(shData0.z);
    vec4 r3 = sunpack8888(shData0.w);

    vec4 g0 = sunpack8888(shData1.x);
    vec4 g1 = sunpack8888(shData1.y);
    vec4 g2 = sunpack8888(shData1.z);
    vec4 g3 = sunpack8888(shData1.w);

    vec4 b0 = sunpack8888(shData2.x);
    vec4 b1 = sunpack8888(shData2.y);
    vec4 b2 = sunpack8888(shData2.z);
    vec4 b3 = sunpack8888(shData2.w);

    sh[0] =  vec3(r0.x, g0.x, b0.x);
    sh[1] =  vec3(r0.y, g0.y, b0.y);
    sh[2] =  vec3(r0.z, g0.z, b0.z);
    sh[3] =  vec3(r0.w, g0.w, b0.w);
    sh[4] =  vec3(r1.x, g1.x, b1.x);
    sh[5] =  vec3(r1.y, g1.y, b1.y);
    sh[6] =  vec3(r1.z, g1.z, b1.z);
    sh[7] =  vec3(r1.w, g1.w, b1.w);
    sh[8] =  vec3(r2.x, g2.x, b2.x);
    sh[9] =  vec3(r2.y, g2.y, b2.y);
    sh[10] = vec3(r2.z, g2.z, b2.z);
    sh[11] = vec3(r2.w, g2.w, b2.w);
    sh[12] = vec3(r3.x, g3.x, b3.x);
    sh[13] = vec3(r3.y, g3.y, b3.y);
    sh[14] = vec3(r3.z, g3.z, b3.z);
}

// see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
vec3 evalSH(in SplatState state) {
    vec3 result = vec3(0.0);

    // transform camera-space view vector to model space
    vec3 dir = normalize(state.centerCam * mat3(matrix_view) * mat3(matrix_model));

    vec3 sh[15];
    readSHData(state, sh);

    // 1st degree
    float x = dir.x;
    float y = dir.y;
    float z = dir.z;

    result += SH_C1 * (-sh[0] * y + sh[1] * z - sh[2] * x);

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

    // 3rd degree
    result +=
        sh[8]  * (SH_C3_0 * y * (3.0 * xx - yy)) +
        sh[9]  * (SH_C3_1 * xy * z) +
        sh[10] * (SH_C3_2 * y * (4.0 * zz - xx - yy)) +
        sh[11] * (SH_C3_3 * z * (2.0 * zz - 3.0 * xx - 3.0 * yy)) +
        sh[12] * (SH_C3_4 * x * (4.0 * zz - xx - yy)) +
        sh[13] * (SH_C3_5 * z * (xx - yy)) +
        sh[14] * (SH_C3_6 * x * (xx - 3.0 * yy));

    return result;
}
#endif
`;
