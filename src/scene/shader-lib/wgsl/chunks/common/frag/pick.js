export default /* wgsl */`
uniform meshInstanceId: u32;

fn getPickOutput() -> vec4f {
    let inv: vec4f = vec4f(1.0 / 255.0);
    let shifts: vec4u = vec4u(16u, 8u, 0u, 24u);
    let col: vec4u = (vec4u(uniform.meshInstanceId) >> shifts) & vec4u(0xffu);
    return vec4f(col) * inv;
}`;
