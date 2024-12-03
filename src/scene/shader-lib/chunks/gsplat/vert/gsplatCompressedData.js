export default /* glsl */`
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

vec3 unpack111011(uint bits) {
    return vec3(
        float(bits >> 21u) / 2047.0,
        float((bits >> 11u) & 0x3ffu) / 1023.0,
        float(bits & 0x7ffu) / 2047.0
    );
}

vec4 unpack8888(uint bits) {
    return vec4(
        float(bits >> 24u) / 255.0,
        float((bits >> 16u) & 0xffu) / 255.0,
        float((bits >> 8u) & 0xffu) / 255.0,
        float(bits & 0xffu) / 255.0
    );
}

const float norm = 1.0 / (sqrt(2.0) * 0.5);

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
`;
