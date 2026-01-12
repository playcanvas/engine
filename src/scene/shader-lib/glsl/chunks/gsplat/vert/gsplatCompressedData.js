export default /* glsl */`
#include "gsplatPackingPS"

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

const float norm = sqrt(2.0);

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


// read center
vec3 readCenter(SplatSource source) {
    uint w = uint(textureSize(chunkTexture, 0).x) / 5u;
    uint chunkId = source.id / 256u;
    ivec2 chunkUV = ivec2((chunkId % w) * 5u, chunkId / w);

    // read chunk and packed compressed data
    chunkDataA = texelFetch(chunkTexture, chunkUV, 0);
    chunkDataB = texelFetch(chunkTexture, chunkUV + ivec2(1, 0), 0);
    chunkDataC = texelFetch(chunkTexture, chunkUV + ivec2(2, 0), 0);
    chunkDataD = texelFetch(chunkTexture, chunkUV + ivec2(3, 0), 0);
    chunkDataE = texelFetch(chunkTexture, chunkUV + ivec2(4, 0), 0);
    packedData = texelFetch(packedTexture, source.uv, 0);

    return mix(chunkDataA.xyz, vec3(chunkDataA.w, chunkDataB.xy), unpack111011(packedData.x));
}

vec4 readColor(in SplatSource source) {
    vec4 r = unpack8888(packedData.w);
    return vec4(mix(chunkDataD.xyz, vec3(chunkDataD.w, chunkDataE.xy), r.rgb), r.w);
}

vec4 getRotation() {
    return unpackRotation(packedData.y);
}

vec3 getScale() {
    return exp(mix(vec3(chunkDataB.zw, chunkDataC.x), chunkDataC.yzw, unpack111011(packedData.z)));
}
`;
