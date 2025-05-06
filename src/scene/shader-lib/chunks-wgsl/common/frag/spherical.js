export default /* wgsl */`

fn toSpherical(dir: vec3f) -> vec2f {
    let angle_xz = select(0.0, atan2(dir.x, dir.z), any(dir.xz != vec2f(0.0)));
    return vec2f(angle_xz, asin(dir.y));
}

fn toSphericalUv(dir : vec3f) -> vec2f {
    const PI : f32 = 3.141592653589793;
    let uv : vec2f = toSpherical(dir) / vec2f(PI * 2.0, PI) + vec2f(0.5, 0.5);
    return vec2f(uv.x, 1.0 - uv.y);
}
`;
