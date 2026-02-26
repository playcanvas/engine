// Read functions for compact work buffer format (20 bytes/splat):
// - dataColor: R32U (4B): RGB color (11+11+10 bits, range [0, 4])
// - dataTransformA: RGBA32U (16B): center.xyz as f32 + half-angle quaternion (11+11+10 bits)
// - dataTransformB: R32U (4B): scale.xyz as 3x8-bit log-encoded + alpha (8 bits)
export default /* glsl */`
uvec4 cachedTransformA;
uint cachedTransformB;

vec3 getCenter() {
    cachedTransformA = loadDataTransformA();
    cachedTransformB = loadDataTransformB().x;
    return vec3(uintBitsToFloat(cachedTransformA.r), uintBitsToFloat(cachedTransformA.g), uintBitsToFloat(cachedTransformA.b));
}

vec4 getColor() {
    uint packed = loadDataColor().x;
    float r = float(packed & 0x7FFu) * (4.0 / 2047.0);
    float g = float((packed >> 11u) & 0x7FFu) * (4.0 / 2047.0);
    float b = float((packed >> 22u) & 0x3FFu) * (4.0 / 1023.0);
    float a = float(cachedTransformB >> 24u) / 255.0;
    return vec4(r, g, b, a);
}

vec4 getRotation() {
    uint packed = cachedTransformA.a;

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
    uint packed = cachedTransformB;
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
