// Radix sort count - single quad processing chunk
// This chunk is included 4 times with {i} = 0, 1, 2, 3 (quad index)
// Uses BOUNDS_CHECK define to conditionally include bounds checking for partial groups
//
// Required variables from parent scope:
//   keyIndex, cBit, mask4, digitIdx4, elemCount4, QUAD_OFFSETS, count
//   SOURCE_LINEAR variant: sw (texture width)
export default /* wgsl */`

// ============================================
// Quad {i}: Process elements at offset {i} * 4
// ============================================
{
    // Calculate element indices for this quad
    let base = {i}u * 4u;
    var mi4 = (keyIndex + base) + QUAD_OFFSETS;

    // Load keys from texture - different coordinate calculation per variant
    #ifdef SOURCE_LINEAR
        // Linear layout: convert linear index to 2D coordinates
        var y4 = vec4i(mi4) / sw;
        var x4 = vec4i(mi4) - y4 * sw;
        var keys = vec4u(
            textureLoad(keysTexture, vec2i(x4.x, y4.x), 0).r,
            textureLoad(keysTexture, vec2i(x4.y, y4.y), 0).r,
            textureLoad(keysTexture, vec2i(x4.z, y4.z), 0).r,
            textureLoad(keysTexture, vec2i(x4.w, y4.w), 0).r
        );
    #else
        // Morton layout: use Z-order curve lookup
        var keys = vec4u(
            textureLoad(keysTexture, indexToUV(mi4.x), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.y), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.z), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.w), 0).r
        );
    #endif

    // Extract digits and count matches
    var digits = (keys >> vec4u(cBit)) & mask4;
    var m4 = select(vec4u(0u), vec4u(1u), digits == digitIdx4);

    // Bounds checking - only included for partial groups (last group)
    #ifdef BOUNDS_CHECK
        // Zero out counts for elements past elementCount
        m4 = select(m4, vec4u(0u), mi4 >= elemCount4);
    #endif

    // Accumulate count
    count += m4.x + m4.y + m4.z + m4.w;
}
`;

