// Chunk that allows us to store all 32bits of float in a single RGBA8 texture without any loss of
// precision. The float value is encoded to RGBA8 and decoded back to float. Used as a fallback
// for platforms that do not support float textures but need to render to a float texture (without
// filtering)
export default /* glsl */`

#ifndef FLOAT_AS_UINT
#define FLOAT_AS_UINT

// encode float value to RGBA8
vec4 float2uint(float value) {
    uint intBits = floatBitsToUint(value);
    return vec4(
        float((intBits >> 24u) & 0xFFu) / 255.0,
        float((intBits >> 16u) & 0xFFu) / 255.0,
        float((intBits >> 8u) & 0xFFu) / 255.0,
        float(intBits & 0xFFu) / 255.0
    );
}

// decode RGBA8 value to float
float uint2float(vec4 value) {
    uint intBits = 
        (uint(value.r * 255.0) << 24u) |
        (uint(value.g * 255.0) << 16u) |
        (uint(value.b * 255.0) << 8u) |
        uint(value.a * 255.0);

    return uintBitsToFloat(intBits);
}

#endif // FLOAT_AS_UINT
`;
