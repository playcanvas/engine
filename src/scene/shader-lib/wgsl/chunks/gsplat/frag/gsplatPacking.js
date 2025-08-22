export default /* wgsl */`
fn pack8888(v: vec4f) -> u32 {
    let t = vec4u(v * 255.0) << vec4u(24u, 16u, 8u, 0u);
    return t.x | t.y | t.z | t.w;
}

fn pack101010(v: vec3f) -> u32 {
    let t = vec3u(v * vec3f(1023.0, 1023.0, 1023.0)) << vec3u(20u, 10u, 0u);
    return t.x | t.y | t.z;
}

fn pack111110(v: vec3f) -> u32 {
    let t = vec3u(v * vec3f(2047.0, 2047.0, 1023.0)) << vec3u(21u, 10u, 0u);
    return t.x | t.y | t.z;
}

fn unpack8888(v: u32) -> vec4f {
    return vec4f((vec4u(v) >> vec4u(24u, 16u, 8u, 0u)) & vec4u(0xffu)) / 255.0;
}

fn unpack101010(v: u32) -> vec3f {
    return vec3f((vec3u(v) >> vec3u(20u, 10u, 0u)) & vec3u(0x3ffu)) / 1023.0;
}

fn unpack111110(v: u32) -> vec3f {
    return vec3f((vec3u(v) >> vec3u(21u, 10u, 0u)) & vec3u(0x7ffu, 0x7ffu, 0x3ffu)) / vec3f(2047.0, 2047.0, 1023.0);
}

// resolve the sample using the supplied codebook and return a normalized value relative to codebook min and max
fn resolveCodebook(s: vec3f, codebook: ptr<uniform, array<vec4f, 64>>) -> vec3f {
    let idx = vec3u(s * 255.0);
    let v = vec3f(
        codebook[idx.x >> 2u][idx.x & 3u],
        codebook[idx.y >> 2u][idx.y & 3u],
        codebook[idx.z >> 2u][idx.z & 3u]
    );
    return (v - codebook[0].x) / (codebook[63].w - codebook[0].x);
}
`;