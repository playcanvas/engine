// Read functions for compact work buffer format (20 bytes/splat):
// - dataColor: R32U (4B): RGB color (11+11+10 bits, range [0, 4])
// - dataTransformA: RGBA32U (16B): center.xyz as f32 + scale.xyz (3x8-bit log-encoded) + alpha (8 bits)
// - dataTransformB: R32U (4B): half-angle quaternion (11+11+10 bits)
export default /* glsl */`
// Required call order: getCenter() first, then getOpacity() for early culling (no extra loads),
// then getColor() (returns RGB only). getRotation(), getScale() can follow in any order.
uvec4 cachedTransformA;

vec3 getCenter() {
    cachedTransformA = loadDataTransformA();
    return vec3(uintBitsToFloat(cachedTransformA.r), uintBitsToFloat(cachedTransformA.g), uintBitsToFloat(cachedTransformA.b));
}

float getOpacity() {
    return float(cachedTransformA.a >> 24u) / 255.0;
}

vec3 getColor() {
    uint packed = loadDataColor().x;
    float r = float(packed & 0x7FFu) * (4.0 / 2047.0);
    float g = float((packed >> 11u) & 0x7FFu) * (4.0 / 2047.0);
    float b = float((packed >> 22u) & 0x3FFu) * (4.0 / 1023.0);
    return vec3(r, g, b);
}

vec4 getRotation() {
    uint packed = loadDataTransformB().x;

    // dequantize half-angle projected quaternion: 11+11+10 bits to [-1, 1]
    vec3 p = vec3(
        float(packed & 0x7FFu) / 2047.0 * 2.0 - 1.0,
        float((packed >> 11u) & 0x7FFu) / 2047.0 * 2.0 - 1.0,
        float((packed >> 22u) & 0x3FFu) / 1023.0 * 2.0 - 1.0
    );

    // inverse half-angle transform, returns (w, x, y, z) format
    float d = dot(p, p);
    return vec4(1.0 - d, sqrt(max(0.0, 2.0 - d)) * p);
}

vec3 getScale() {
    uint packed = cachedTransformA.a;
    float sx = float(packed & 0xFFu);
    float sy = float((packed >> 8u) & 0xFFu);
    float sz = float((packed >> 16u) & 0xFFu);

    // decode log-encoded scale: 0 = true zero, 1-255 maps linearly in log-space to e^-12..e^9
    const float logRange = 21.0 / 255.0;
    const float logMin = -12.0;
    return vec3(
        sx == 0.0 ? 0.0 : exp(sx * logRange + logMin),
        sy == 0.0 ? 0.0 : exp(sy * logRange + logMin),
        sz == 0.0 ? 0.0 : exp(sz * logRange + logMin)
    );
}
`;
