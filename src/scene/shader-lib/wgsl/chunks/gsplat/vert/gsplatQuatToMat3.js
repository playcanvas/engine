export default /* wgsl */`
fn quatToMat3(R: vec4<f32>) -> mat3x3<f32> {
    let R2: vec4<f32> = R + R;
    let X: f32       = R2.x * R.w;
    let Y: vec4<f32> = R2.y * R;
    let Z: vec4<f32> = R2.z * R;
    let W: f32       = R2.w * R.w;

    return mat3x3<f32>(
        1.0 - Z.z - W,  Y.z + X,      Y.w - Z.x,
        Y.z - X,        1.0 - Y.y - W, Z.w + Y.x,
        Y.w + Z.x,      Z.w - Y.x,     1.0 - Y.y - Z.z
    );
}

// Quaternion multiplication: result = a * b
fn quatMul(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
    return vec4<f32>(
        a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
    );
}
`;
