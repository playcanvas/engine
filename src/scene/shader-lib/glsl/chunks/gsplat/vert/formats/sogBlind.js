// SOG v3 blind data decoding, used by the generated getBlind_<name>() accessors (see
// gsplat-sog-blind.js). Their arguments are constants, so the shifts and masks fold away.
export default /* glsl */`
// the 'bytes' little-endian bytes of an RGBA8 texel starting at byte 'offset' (0 = R)
uint sogBlindBits(vec4 texel, uint offset, uint bytes) {
    uvec4 b = uvec4(texel * 255.0 + 0.5);
    uint word = b.x | (b.y << 8u) | (b.z << 16u) | (b.w << 24u);
    return (word >> (8u * offset)) & (0xffffffffu >> (32u - 8u * bytes));
}

float sogBlindF16(uint bits) {
    return unpackHalf2x16(bits).x;
}

float sogBlindF32(uint bits) {
    return uintBitsToFloat(bits);
}

// a unorm code of 'steps' steps, mapped linearly to [lo, hi]
float sogBlindUnorm(uint bits, float steps, float lo, float hi) {
    return lo + float(bits) / steps * (hi - lo);
}
`;
