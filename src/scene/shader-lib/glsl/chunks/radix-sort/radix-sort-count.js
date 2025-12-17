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
    
    // Out of bounds check
    if (keyIndex >= uint(elementCount)) {
        pcFragColor0 = 0.0;
        return;
    }
    
    // Count how many elements in this group have the target digit
    // Vectorized: process 4 elements at a time using uvec4/bvec4
    uint count = 0u;
    uint mask = (1u << uint(bitsPerStep)) - 1u;
    uint cBit = uint(currentBit);
    uvec4 digitIdx4 = uvec4(digitIndex);
    uvec4 mask4 = uvec4(mask);
    const uvec4 QUAD_OFFSETS = uvec4(0u, 1u, 2u, 3u);
    
    #ifdef SOURCE_LINEAR
        uint sw = uint(textureSize(keysTexture, 0).x);
        #define COUNT_QUAD(base) { \
            uvec4 mi4 = (keyIndex + base) + QUAD_OFFSETS; \
            uvec4 y4 = mi4 / sw; \
            uvec4 x4 = mi4 - y4 * sw; \
            uvec4 keys = uvec4( \
                texelFetch(keysTexture, ivec2(x4.x, y4.x), 0).r, \
                texelFetch(keysTexture, ivec2(x4.y, y4.y), 0).r, \
                texelFetch(keysTexture, ivec2(x4.z, y4.z), 0).r, \
                texelFetch(keysTexture, ivec2(x4.w, y4.w), 0).r \
            ); \
            uvec4 digits = (keys >> cBit) & mask4; \
            uvec4 m4 = uvec4(equal(digits, digitIdx4)); \
            count += m4.x + m4.y + m4.z + m4.w; \
        }
    #else
        #define COUNT_QUAD(base) { \
            uvec4 mi4 = (keyIndex + base) + QUAD_OFFSETS; \
            uvec4 keys = uvec4( \
                texelFetch(keysTexture, indexToUV(mi4.x), 0).r, \
                texelFetch(keysTexture, indexToUV(mi4.y), 0).r, \
                texelFetch(keysTexture, indexToUV(mi4.z), 0).r, \
                texelFetch(keysTexture, indexToUV(mi4.w), 0).r \
            ); \
            uvec4 digits = (keys >> cBit) & mask4; \
            uvec4 m4 = uvec4(equal(digits, digitIdx4)); \
            count += m4.x + m4.y + m4.z + m4.w; \
        }
    #endif
    
    COUNT_QUAD(0u)
    COUNT_QUAD(4u)
    COUNT_QUAD(8u)
    COUNT_QUAD(12u)
    
    #undef COUNT_QUAD
    
    // Output the count as raw float (R32F format)
    pcFragColor0 = float(count);
}
`;
