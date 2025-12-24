export default /* wgsl */`
var transformA: texture_2d<u32>;
var transformB: texture_2d<uff>;

// work values
var<private> tAw: u32;
var<private> tBcached: vec4f;

// read the model-space center of the gaussian
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {
    // read transform data
    let tA: vec4<u32> = textureLoad(transformA, source.uv, 0);
    tAw = tA.w;
    tBcached = textureLoad(transformB, source.uv, 0);
    return bitcast<vec3f>(tA.xyz);
}

fn unpackRotation(packed: vec3f) -> vec4f {
    return vec4f(packed.xyz, sqrt(max(0.0, 1.0 - dot(packed, packed))));
}

fn getRotation() -> vec4f {
    return unpackRotation(vec3f(unpack2x16float(tAw), tBcached.w)).wxyz;
}

fn getScale() -> vec3f {
    return tBcached.xyz;
}
`;
