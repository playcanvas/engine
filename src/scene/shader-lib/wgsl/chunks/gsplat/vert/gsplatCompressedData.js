export default /* wgsl */`
#include "gsplatPackingPS"

var packedTexture: texture_2d<u32>;
var chunkTexture: texture_2d<uff>;

// work values
var<private> chunkDataA: vec4f;    // x: min_x, y: min_y, z: min_z, w: max_x
var<private> chunkDataB: vec4f;    // x: max_y, y: max_z, z: scale_min_x, w: scale_min_y
var<private> chunkDataC: vec4f;    // x: scale_min_z, y: scale_max_x, z: scale_max_y, w: scale_max_z
var<private> chunkDataD: vec4f;    // x: min_r, y: min_g, z: min_b, w: max_r
var<private> chunkDataE: vec4f;    // x: max_g, y: max_b, z: unused, w: unused
var<private> packedData: vec4u;    // x: position bits, y: rotation bits, z: scale bits, w: color bits

fn unpack111011(bits: u32) -> vec3f {
    return (vec3f((vec3<u32>(bits) >> vec3<u32>(21u, 11u, 0u)) & vec3<u32>(0x7ffu, 0x3ffu, 0x7ffu))) / vec3f(2047.0, 1023.0, 2047.0);
}

const norm_const: f32 = sqrt(2.0);

fn unpackRotation(bits: u32) -> vec4f {
    let a = (f32((bits >> 20u) & 0x3ffu) / 1023.0 - 0.5) * norm_const;
    let b = (f32((bits >> 10u) & 0x3ffu) / 1023.0 - 0.5) * norm_const;
    let c = (f32(bits & 0x3ffu) / 1023.0 - 0.5) * norm_const;
    let m = sqrt(1.0 - (a * a + b * b + c * c));

    let mode = bits >> 30u;
    if (mode == 0u) { return vec4f(m, a, b, c); }
    if (mode == 1u) { return vec4f(a, m, b, c); }
    if (mode == 2u) { return vec4f(a, b, m, c); }
    return vec4f(a, b, c, m);
}

// read center
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {
    let tex_size_u = textureDimensions(chunkTexture, 0);
    let w: u32 = tex_size_u.x / 5u;
    let chunkId: u32 = source.id / 256u;
    let chunkUV: vec2<i32> = vec2<i32>(i32((chunkId % w) * 5u), i32(chunkId / w));

    // read chunk and packed compressed data
    chunkDataA = textureLoad(chunkTexture, chunkUV + vec2<i32>(0, 0), 0);
    chunkDataB = textureLoad(chunkTexture, chunkUV + vec2<i32>(1, 0), 0);
    chunkDataC = textureLoad(chunkTexture, chunkUV + vec2<i32>(2, 0), 0);
    chunkDataD = textureLoad(chunkTexture, chunkUV + vec2<i32>(3, 0), 0);
    chunkDataE = textureLoad(chunkTexture, chunkUV + vec2<i32>(4, 0), 0);
    packedData = textureLoad(packedTexture, source.uv, 0);

    return mix(chunkDataA.xyz, vec3f(chunkDataA.w, chunkDataB.xy), unpack111011(packedData.x));
}

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    let r = unpack8888(packedData.w);
    return vec4f(mix(chunkDataD.xyz, vec3f(chunkDataD.w, chunkDataE.xy), r.rgb), r.w);
}

fn getRotation() -> vec4f {
    return unpackRotation(packedData.y);
}

fn getScale() -> vec3f {
    return exp(mix(vec3f(chunkDataB.zw, chunkDataC.x), chunkDataC.yzw, unpack111011(packedData.z)));
}

// given a rotation matrix and scale vector, compute 3d covariance A and B
fn readCovariance(source: ptr<function, SplatSource>, covA_ptr: ptr<function, vec3f>, covB_ptr: ptr<function, vec3f>) {
    let rot = quatToMat3(getRotation());
    let scale = getScale();

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
