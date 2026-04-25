// Uncompressed GSplat format - work variables, helpers, and read functions
// Texture declarations and load functions are auto-generated from GSplatFormat streams
export default /* wgsl */`

// work values
var<private> tAw: u32;
var<private> tBcached: vec4f;

fn unpackRotation(packed: vec3f) -> vec4f {
    return vec4f(packed.xyz, sqrt(max(0.0, 1.0 - dot(packed, packed))));
}

// read the model-space center of the gaussian
fn getCenter() -> vec3f {
    // read transform data using generated load functions (use global splat.uv)
    let tA: vec4<u32> = loadTransformA();
    tAw = tA.w;
    tBcached = loadTransformB();
    return bitcast<vec3f>(tA.xyz);
}

fn getColor() -> vec4f {
    return loadSplatColor();
}

fn getRotation() -> vec4f {
    return unpackRotation(vec3f(unpack2x16float(tAw), tBcached.w)).wxyz;
}

fn getScale() -> vec3f {
    return tBcached.xyz;
}

#include "gsplatUncompressedSHVS"
`;
