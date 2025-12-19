// Radix sort count - single quad processing chunk
// This chunk is included 4 times with {i} = 0, 1, 2, 3 (quad index)
// Uses BOUNDS_CHECK define to conditionally include bounds checking for partial groups
//
// Required variables from parent scope:
//   keyIndex, cBit, mask4, digitIdx4, elemCount4, QUAD_OFFSETS, count
//   SOURCE_LINEAR variant: sw (texture width)
export default /* glsl */`

// ============================================
// Quad {i}: Process elements at offset {i} * 4
// ============================================
{
    // Calculate element indices for this quad
    uint base = {i}u * 4u;
    uvec4 mi4 = (keyIndex + base) + QUAD_OFFSETS;

    // Load keys from texture - different coordinate calculation per variant
    #ifdef SOURCE_LINEAR
        // Linear layout: convert linear index to 2D coordinates
        uvec4 y4 = mi4 / uint(sw);
        uvec4 x4 = mi4 - y4 * uint(sw);
        uvec4 keys = uvec4(
            texelFetch(keysTexture, ivec2(x4.x, y4.x), 0).r,
            texelFetch(keysTexture, ivec2(x4.y, y4.y), 0).r,
            texelFetch(keysTexture, ivec2(x4.z, y4.z), 0).r,
            texelFetch(keysTexture, ivec2(x4.w, y4.w), 0).r
        );
    #else
        // Morton layout: use Z-order curve lookup
        uvec4 keys = uvec4(
            texelFetch(keysTexture, indexToUV(mi4.x), 0).r,
            texelFetch(keysTexture, indexToUV(mi4.y), 0).r,
            texelFetch(keysTexture, indexToUV(mi4.z), 0).r,
            texelFetch(keysTexture, indexToUV(mi4.w), 0).r
        );
    #endif

    // Extract digits and count matches
    uvec4 digits = (keys >> cBit) & mask4;
    uvec4 m4 = uvec4(equal(digits, digitIdx4));

    // Bounds checking - only included for partial groups (last group)
    #ifdef BOUNDS_CHECK
        // Zero out counts for elements past elementCount
        m4 *= uvec4(lessThan(mi4, elemCount4));
    #endif

    // Accumulate count
    count += m4.x + m4.y + m4.z + m4.w;
}
`;

