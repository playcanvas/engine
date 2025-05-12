export default /* wgsl */`
var transformA: texture_2d<u32>;
var transformB: texture_2d<f32>;

// work values
var<private> tAw: u32;

// read the model-space center of the gaussian
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {
    // read transform data
    let tA: vec4<u32> = textureLoad(transformA, source.uv, 0);
    tAw = tA.w;
    return bitcast<vec3f>(tA.xyz);
}

fn quatToMat3(R: vec4f) -> mat3x3f {
    let x: f32 = R.w;
    let y: f32 = R.x;
    let z: f32 = R.y;
    let w: f32 = R.z;

    // pre-calculate squares and products
    let xx: f32 = x * x; let yy: f32 = y * y; let zz: f32 = z * z; let ww: f32 = w * w;
    let xy: f32 = x * y; let xz: f32 = x * z; let xw: f32 = x * w;
    let yz: f32 = y * z; let yw: f32 = y * w; let zw: f32 = z * w;

    return mat3x3f(
        vec3f(
            1.0 - 2.0 * (zz + ww),
            2.0 * (yz + xw),
            2.0 * (yw - xz)
        ), vec3f(
            2.0 * (yz - xw),
            1.0 - 2.0 * (yy + ww),
            2.0 * (zw + xy)
        ), vec3f(
            2.0 * (yw + xz),
            2.0 * (zw - xy),
            1.0 - 2.0 * (yy + zz)
        )
    );
}

fn unpackRotation(packed: vec3f) -> vec4f {
    return vec4f(packed.xyz, sqrt(max(0.0, 1.0 - dot(packed, packed))));
}

// sample covariance vectors
fn readCovariance(source: ptr<function, SplatSource>, covA_ptr: ptr<function, vec3f>, covB_ptr: ptr<function, vec3f>) {
    let tB: vec4f = textureLoad(transformB, source.uv, 0);

    let rot: mat3x3f = quatToMat3(unpackRotation(vec3f(unpack2x16float(bitcast<u32>(tAw)), tB.w)));
    let scale: vec3f = tB.xyz;

    // M = S * R
    let M = transpose(mat3x3f(
        scale.x * rot[0],
        scale.y * rot[1],
        scale.z * rot[2]
    ));

    *covA_ptr = vec3f(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
    *covB_ptr = vec3f(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));
}
`;
