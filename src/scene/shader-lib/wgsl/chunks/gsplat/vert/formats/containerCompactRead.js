// Read functions for compact work buffer format (20 bytes/splat):
// - dataColor: R32U (4B): RGB color (11+11+10 bits, range [0, 4])
// - dataTransformA: RGBA32U (16B): center.xyz as f32 + scale.xyz (3x8-bit log-encoded) + alpha (8 bits)
// - dataTransformB: R32U (4B): half-angle quaternion (11+11+10 bits)
export default /* wgsl */`
// Required call order: getCenter() first, then getOpacity() for early culling (no extra loads),
// then getColor() (returns RGB only). getRotation(), getScale() can follow in any order.
var<private> cachedTransformA: vec4u;

fn getCenter() -> vec3f {
    cachedTransformA = loadDataTransformA();
    return vec3f(bitcast<f32>(cachedTransformA.r), bitcast<f32>(cachedTransformA.g), bitcast<f32>(cachedTransformA.b));
}

fn getOpacity() -> f32 {
    return f32(cachedTransformA.a >> 24u) / 255.0;
}

fn getColor() -> vec3f {
    let packed = loadDataColor().x;
    let r = f32(packed & 0x7FFu) * (4.0 / 2047.0);
    let g = f32((packed >> 11u) & 0x7FFu) * (4.0 / 2047.0);
    let b = f32((packed >> 22u) & 0x3FFu) * (4.0 / 1023.0);
    return vec3f(r, g, b);
}

fn getRotation() -> vec4f {
    let packed = loadDataTransformB().x;

    // dequantize half-angle projected quaternion: 11+11+10 bits to [-1, 1]
    let p = vec3f(
        f32(packed & 0x7FFu) / 2047.0 * 2.0 - 1.0,
        f32((packed >> 11u) & 0x7FFu) / 2047.0 * 2.0 - 1.0,
        f32((packed >> 22u) & 0x3FFu) / 1023.0 * 2.0 - 1.0
    );

    // inverse half-angle transform, returns (w, x, y, z) format
    let d = dot(p, p);
    return vec4f(1.0 - d, sqrt(max(0.0, 2.0 - d)) * p);
}

fn getScale() -> vec3f {
    let packed = cachedTransformA.a;
    let sx = f32(packed & 0xFFu);
    let sy = f32((packed >> 8u) & 0xFFu);
    let sz = f32((packed >> 16u) & 0xFFu);

    // decode log-encoded scale: 0 = true zero, 1-255 maps linearly in log-space to e^-12..e^9
    let logRange = 21.0 / 255.0;
    let logMin = -12.0;
    return vec3f(
        select(exp(sx * logRange + logMin), 0.0, sx == 0.0),
        select(exp(sy * logRange + logMin), 0.0, sy == 0.0),
        select(exp(sz * logRange + logMin), 0.0, sz == 0.0)
    );
}
`;
