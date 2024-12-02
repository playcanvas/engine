export default /* glsl */`
#include "gsplatUnpackVS"

attribute vec3 vertex_position;         // xy: cornerUV, z: render order offset
attribute uint vertex_id_attrib;        // render order base

uniform uvec3 tex_params;               // num splats, packed width, chunked width
uniform highp usampler2D splatOrder;
uniform highp usampler2D packedTexture;
uniform highp sampler2D chunkTexture;

// work values
vec4 chunkDataA;    // x: min_x, y: min_y, z: min_z, w: max_x
vec4 chunkDataB;    // x: max_y, y: max_z, z: scale_min_x, w: scale_min_y
vec4 chunkDataC;    // x: scale_min_z, y: scale_max_x, z: scale_max_y, w: scale_max_z
vec4 chunkDataD;    // x: min_r, y: min_g, z: min_b, w: max_r
vec4 chunkDataE;    // x: max_g, y: max_b, z: unused, w: unused
uvec4 packedData;   // x: position bits, y: rotation bits, z: scale bits, w: color bits

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
    state.cornerUV = vertex_position.xy;

    return true;
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

// given a rotation matrix and scale vector, compute 3d covariance A and B
void readCovariance(in SplatState state, out vec3 covA, out vec3 covB) {
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

// spherical Harmonics

#if SH_BANDS > 0

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

#endif
`;
