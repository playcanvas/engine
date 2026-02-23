export default /* wgsl */`
// Rotation source data is f16 - compute in half precision
fn quatToMat3(r: half4) -> half3x3 {
    let r2: half4 = r + r;
    let x: half   = r2.x * r.w;
    let y: half4  = r2.y * r;
    let z: half4  = r2.z * r;
    let w: half   = r2.w * r.w;

    return half3x3(
        half(1.0) - z.z - w,  y.z + x,              y.w - z.x,
        y.z - x,              half(1.0) - y.y - w,   z.w + y.x,
        y.w + z.x,            z.w - y.x,             half(1.0) - y.y - z.z
    );
}

fn quatMul(a: vec4f, b: vec4f) -> vec4f {
    let ha: half4 = half4(a);
    let hb: half4 = half4(b);
    let r: half4 = half4(
        ha.w * hb.x + ha.x * hb.w + ha.y * hb.z - ha.z * hb.y,
        ha.w * hb.y - ha.x * hb.z + ha.y * hb.w + ha.z * hb.x,
        ha.w * hb.z + ha.x * hb.y - ha.y * hb.x + ha.z * hb.w,
        ha.w * hb.w - ha.x * hb.x - ha.y * hb.y - ha.z * hb.z
    );
    return vec4f(r);
}
`;
