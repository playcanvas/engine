// Count digits shader - Pass 0 of radix sort
// Counts how many elements in each group have a specific digit value
//
// Variants:
// - SOURCE_LINEAR: Read from linear-layout source texture (first pass)
// - (default): Read from Morton-layout internal texture (subsequent passes)
export default /* glsl */`
uniform highp usampler2D keysTexture;

uniform int bitsPerStep;
uniform int groupSize;
uniform int elementCount;
uniform int imageElementsLog2;
uniform int currentBit;

varying vec2 uv0;

// Morton code functions for Z-order curve indexing
uint interleaveWithZero(uint word) {
    word = (word ^ (word << 8u)) & 0x00ff00ffu;
    word = (word ^ (word << 4u)) & 0x0f0f0f0fu;
    word = (word ^ (word << 2u)) & 0x33333333u;
    word = (word ^ (word << 1u)) & 0x55555555u;
    return word;
}

uint deinterleaveWithZero(uint word) {
    word &= 0x55555555u;
    word = (word | (word >> 1u)) & 0x33333333u;
    word = (word | (word >> 2u)) & 0x0f0f0f0fu;
    word = (word | (word >> 4u)) & 0x00ff00ffu;
    word = (word | (word >> 8u)) & 0x0000ffffu;
    return word;
}

ivec2 indexToUV(uint index) {
    return ivec2(deinterleaveWithZero(index), deinterleaveWithZero(index >> 1u));
}

uint uvToIndex(ivec2 uv) {
    return interleaveWithZero(uint(uv.x)) | (interleaveWithZero(uint(uv.y)) << 1u);
}

void main() {
    // Get current pixel position
    ivec2 pixel = ivec2(gl_FragCoord.xy);
    uint morton = uvToIndex(pixel);
    
    // Calculate which digit and which group this pixel represents
    uint elementsLog2 = uint(imageElementsLog2);
    uint groupsLog2 = elementsLog2 - uint(groupSize);
    uint digitIndex = morton >> groupsLog2;
    uint keyIndex = (morton - (digitIndex << groupsLog2)) << uint(groupSize);
    uint elemCount = uint(elementCount);
    
    // Out of bounds check - this group starts past valid data
    if (keyIndex >= elemCount) {
        pcFragColor0 = 0.0;
        return;
    }
    
    // Setup variables for quad processing
    uint count = 0u;
    uint mask = (1u << uint(bitsPerStep)) - 1u;
    uint cBit = uint(currentBit);
    uvec4 digitIdx4 = uvec4(digitIndex);
    uvec4 mask4 = uvec4(mask);
    uvec4 elemCount4 = uvec4(elemCount);
    const uvec4 QUAD_OFFSETS = uvec4(0u, 1u, 2u, 3u);
    
    // Check if this is a partial group (last group that extends past elementCount)
    bool isPartialGroup = (keyIndex + 16u) > elemCount;
    
    #ifdef SOURCE_LINEAR
        int sw = int(textureSize(keysTexture, 0).x);
    #endif
    
    // Process all 4 quads (16 elements total per group)
    // Use define/undef to control bounds checking at compile time
    #define QUAD_COUNT 4
    if (isPartialGroup) {
        // Partial group: include bounds checking
        #define BOUNDS_CHECK
        #include "radixSortCountQuad, QUAD_COUNT"
        #undef BOUNDS_CHECK
    } else {
        // Full group: no bounds checking needed (fast path)
        #include "radixSortCountQuad, QUAD_COUNT"
    }
    
    // Output the count as raw float (R32F format)
    pcFragColor0 = float(count);
}
`;
