// Generic half-float packing with software fallback for subnormals
// Addresses vendor differences in pack2x16float subnormal handling (e.g., Adreno (TM) 750 on Samsung Galaxy S24)
export default /* wgsl */`

#if defined(PLATFORM_ANDROID)

// Software pack of one f32 -> f16 (low 16 bits). Ties-to-even, full subnormals.
fn floatToHalf(a: f32) -> u32 {
    let u: u32    = bitcast<u32>(a);
    let sign: u32 = (u >> 16u) & 0x8000u;
    let absu: u32 = u & 0x7FFFFFFFu;
    let man: u32  = u & 0x007FFFFFu;
    let e32: i32  = i32((u >> 23u) & 0xFFu) - 127;
    
    // NaN / Inf
    if ((absu & 0x7F800000u) == 0x7F800000u) {
        let isnan = (man != 0u);
        return sign | select(0x7C00u, 0x7E00u, isnan);
    }
    
    // Overflow to Inf
    if (e32 > 15) { return sign | 0x7C00u; }
    
    // Normal half
    if (e32 >= -14) {
        var he: u32 = u32(e32 + 15);
        var hm: u32 = man >> 13u;
        let rem: u32 = man & 0x1FFFu;
        let add: u32 = select(0u, 1u, (rem > 0x1000u) || (rem == 0x1000u && (hm & 1u) == 1u));
        hm = (hm + add) & 0x3FFu;
        if ((hm & 0x400u) != 0u) {
            hm = 0u; he = he + 1u;
            if (he >= 31u) { return sign | 0x7C00u; }
        }
        return sign | (he << 10u) | hm;
    }
    
    // Subnormals
    if (e32 >= -24) {
        let s: u32      = u32(-(e32 + 1));
        let mnorm: u32  = 0x00800000u | man;
        var hm: u32     = mnorm >> s;
        let mask: u32   = (1u << s) - 1u;
        let rem: u32    = mnorm & mask;
        let halfBt: u32 = 1u << (s - 1u);
        let add: u32    = select(0u, 1u, (rem > halfBt) || (rem == halfBt && (hm & 1u) == 1u));
        hm = hm + add;
        if (hm >= 0x400u) { return sign | (1u << 10u); }
        return sign | hm;
    }
    
    return sign; // signed zero
}

// Hybrid pack: software for subnormals, builtin for normal range
fn pack2x16floatSafe(v: vec2f) -> u32 {
    // Convert the input floats to their 32-bit IEEE-754 bit patterns.
    // We'll inspect the exponent bits directly to determine their numeric range.
    let u_x: u32  = bitcast<u32>(v.x);
    let u_y: u32  = bitcast<u32>(v.y);
    
    // Extract the unbiased exponent for each component (float32 uses bias = 127).
    // e32 = exponent - 127  ⇒  actual power of two for each value.
    let e32_x: i32 = i32((u_x >> 23u) & 0xFFu) - 127;
    let e32_y: i32 = i32((u_y >> 23u) & 0xFFu) - 127;
    
    // -------------------------------------------------------------------------
    // Detect values that would become *subnormal* (or zero) in float16.
    //
    //   e32 < -14  ⇔  |value| < 2^-14 ≈ 6.1035e-5
    //
    // Many mobile GPUs (including Adreno and Mali) mishandle half-precision
    // subnormals—typically flushing them to zero or rounding incorrectly.
    // To preserve correct rounding and sign, we use the software conversion
    // path (floatToHalf) for these small magnitudes.
    //
    // The software branch runs very rarely (<0.1% of typical values for
    // normalized scene data) and costs only a few ALU instructions, so the
    // performance impact is negligible while avoiding visible precision loss.
    // -------------------------------------------------------------------------
    if (e32_x < -14 || e32_y < -14) {
        // Convert both components with the reference software routine
        // and pack into a 32-bit uint: low 16 bits = x, high 16 bits = y.
        return (floatToHalf(v.y) << 16u) | floatToHalf(v.x);
    }
    
    // Normal range: use the fast hardware builtin
    return pack2x16float(v);
}

#else

// On non-Android platforms, use builtin directly (no subnormal workaround needed)
fn pack2x16floatSafe(v: vec2f) -> u32 {
    return pack2x16float(v);
}

#endif
`;

