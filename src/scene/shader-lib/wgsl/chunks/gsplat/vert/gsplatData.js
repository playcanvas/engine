export default /* wgsl */`
var transformA: texture_2d<u32>;
var transformB: texture_2d<uff>;

// work values
var<private> tAw: u32;

// read the model-space center of the gaussian
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {
    // read transform data
    let tA: vec4<u32> = textureLoad(transformA, source.uv, 0);
    tAw = tA.w;
    return bitcast<vec3f>(tA.xyz);
}

fn unpackRotation(packed: vec3f) -> vec4f {
    return vec4f(packed.xyz, sqrt(max(0.0, 1.0 - dot(packed, packed))));
}

// sample covariance vectors
fn readCovariance(source: ptr<function, SplatSource>, covA_ptr: ptr<function, vec3f>, covB_ptr: ptr<function, vec3f>) {
    let tB: vec4f = textureLoad(transformB, source.uv, 0);

    let rot: mat3x3f = quatToMat3(unpackRotation(vec3f(unpack2x16float(bitcast<u32>(tAw)), tB.w)).wxyz);
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
