// Generic half-float packing with software fallback for subnormals
// Addresses vendor differences in packHalf2x16 subnormal handling (e.g., Adreno (TM) 750 on Samsung Galaxy S24)
export default /* glsl */`

#if defined(PLATFORM_ANDROID)

    // Software pack of one f32 -> f16 (low 16 bits). Ties-to-even, full subnormals.
    uint floatToHalf(float a) {
        uint u    = floatBitsToUint(a);
        uint sign = (u >> 16u) & 0x8000u;
        uint absu = u & 0x7FFFFFFFu;
        uint man  = u & 0x007FFFFFu;
        int  e32  = int((u >> 23u) & 0xFFu) - 127;
        
        // NaN / Inf
        if ((absu & 0x7F800000u) == 0x7F800000u) {
            bool isnan = (man != 0u);
            return sign | (isnan ? 0x7E00u : 0x7C00u);
        }
        
        // Overflow to Inf
        if (e32 > 15) return sign | 0x7C00u;
        
        // Normal half
        if (e32 >= -14) {
            uint he  = uint(e32 + 15);
            uint hm  = man >> 13u;
            uint rem = man & 0x1FFFu;
            uint add = (rem > 0x1000u || (rem == 0x1000u && (hm & 1u) == 1u)) ? 1u : 0u;
            hm = (hm + add) & 0x3FFu;
            if ((hm & 0x400u) != 0u) {
                hm = 0u; he = he + 1u;
                if (he >= 31u) return sign | 0x7C00u;
            }
            return sign | (he << 10u) | hm;
        }
        
        // Subnormals
        if (e32 >= -24) {
            uint s      = uint(-(e32 + 1));
            uint mnorm  = 0x00800000u | man;
            uint hm     = mnorm >> s;
            uint mask   = (1u << s) - 1u;
            uint rem    = mnorm & mask;
            uint halfBt = 1u << (s - 1u);
            uint add    = (rem > halfBt || (rem == halfBt && (hm & 1u) == 1u)) ? 1u : 0u;
            hm = hm + add;
            if (hm >= 0x400u) return sign | (1u << 10u);
            return sign | hm;
        }
        
        // Underflow to signed zero
        return sign;
    }

    // Hybrid pack: software for subnormals, builtin for normal range
    uint packHalf2x16Safe(vec2 v) {
        // Convert the input floats to their 32-bit IEEE-754 bit patterns.
        // We'll inspect the exponent bits directly to determine their numeric range.
        uint u_x  = floatBitsToUint(v.x);
        uint u_y  = floatBitsToUint(v.y);
        
        // Extract the unbiased exponent for each component (float32 uses bias = 127).
        // e32 = exponent - 127  ⇒  actual power of two for each value.
        int  e32_x = int((u_x >> 23u) & 0xFFu) - 127;
        int  e32_y = int((u_y >> 23u) & 0xFFu) - 127;
        
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
        return packHalf2x16(v);
    }

#else

    // On non-Android platforms, use builtin directly (no subnormal workaround needed)
    uint packHalf2x16Safe(vec2 v) {
        return packHalf2x16(v);
    }

#endif
`;
