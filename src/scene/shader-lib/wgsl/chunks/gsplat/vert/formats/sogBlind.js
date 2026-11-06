// SOG v3 blind data decoding, used by the generated getBlind_<name>() accessors (see
// gsplat-sog-blind.js). Their arguments are constants, so the shifts and masks fold away.
export default /* wgsl */`
// the 'bytes' little-endian bytes of an RGBA8 texel starting at byte 'offset' (0 = R)
fn sogBlindBits(texel: vec4f, offset: u32, bytes: u32) -> u32 {
    let b = vec4u(texel * 255.0 + 0.5);
    let word = b.x | (b.y << 8u) | (b.z << 16u) | (b.w << 24u);
    return (word >> (8u * offset)) & (0xffffffffu >> (32u - 8u * bytes));
}

fn sogBlindF16(bits: u32) -> f32 {
    return unpack2x16float(bits).x;
}

fn sogBlindF32(bits: u32) -> f32 {
    return bitcast<f32>(bits);
}

// a unorm code of 'steps' steps, mapped linearly to [lo, hi]
fn sogBlindUnorm(bits: u32, steps: f32, lo: f32, hi: f32) -> f32 {
    return lo + f32(bits) / steps * (hi - lo);
}
`;
