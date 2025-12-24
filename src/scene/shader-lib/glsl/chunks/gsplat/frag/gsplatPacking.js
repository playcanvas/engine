export default /* glsl */`
uint pack8888(vec4 v) {
    uvec4 t = uvec4(v * 255.0) << uvec4(24u, 16u, 8u, 0u);
    return t.x | t.y | t.z | t.w;
}

uint pack101010(vec3 v) {
    uvec3 t = uvec3(v * 1023.0) << uvec3(20u, 10u, 0u);
    return t.x | t.y | t.z;
}

uint pack111110(vec3 v) {
    uvec3 t = uvec3(v * vec3(2047.0, 2047.0, 1023.0)) << uvec3(21u, 10u, 0u);
    return t.x | t.y | t.z;
}

vec4 unpack8888(uint v) {
    return vec4((uvec4(v) >> uvec4(24u, 16u, 8u, 0u)) & 0xffu) / 255.0;
}

vec3 unpack101010(uint v) {
    return vec3((uvec3(v) >> uvec3(20u, 10u, 0u)) & 0x3ffu) / 1023.0;
}

vec3 unpack111110(uint v) {
    return vec3((uvec3(v) >> uvec3(21u, 10u, 0u)) & uvec3(0x7ffu, 0x7ffu, 0x3ffu)) / vec3(2047.0, 2047.0, 1023.0);
}

// resolve the sample using the supplied codebook and return a normalized value relative to codebook min and max
vec3 resolveCodebook(vec3 s, vec4 codebook[64]) {
    uvec3 idx = uvec3(s * 255.0);
    vec3 v = vec3(
        codebook[idx.x >> 2u][idx.x & 3u],
        codebook[idx.y >> 2u][idx.y & 3u],
        codebook[idx.z >> 2u][idx.z & 3u]
    );
    return (v - codebook[0].x) / (codebook[63].w - codebook[0].x);
}
`;
