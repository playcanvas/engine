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

fn quatMul(a: half4, b: half4) -> half4 {
    return half4(
        a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
    );
}
`;
