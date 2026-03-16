// Binary search reorder shader - Pass 1 of radix sort
// Uses mipmap traversal for O(log n) lookup instead of O(n) linear search
// MRT version: reads from keys + indices textures, writes to two outputs
//
// Variants:
// - SOURCE_LINEAR: Read from linear-layout source texture (first pass)
// - (default): Read from Morton-layout internal texture (subsequent passes)
export default /* glsl */`
uniform highp usampler2D keysTexture;
#ifdef SOURCE_LINEAR
    #define FIRST_PASS
#else
    uniform highp usampler2D indicesTexture;
#endif

uniform highp sampler2D prefixSums;
uniform int bitsPerStep;
uniform int groupSize;
uniform int elementCount;
uniform int imageElementsLog2;
uniform int currentBit;
uniform int imageSize;

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

// Count active texels at a given mip level
// R32F format stores raw counts, mipmaps store averages
// Multiply by 4^level to convert average back to sum
// Uses bit shift instead of pow() for performance
float countActiveTexels(ivec3 uv, ivec2 offset) {
    // 4^level = 2^(level*2) = 1 << (level * 2)
    float scale = float(1u << (uint(uv.z) * 2u));
    return scale * texelFetch(prefixSums, uv.xy + offset, uv.z).r;
}

// Binary search through the mipmap hierarchy to find which source texel
// maps to the given destination index
ivec2 activeTexelIndexToUV(float prefixWidth, float index, out float activePrevTexelSum) {
    float maxLod = round(log2(prefixWidth));
    ivec3 uv = ivec3(0, 0, int(maxLod));
    
    float countTotal = countActiveTexels(uv, ivec2(0, 0));
    activePrevTexelSum = 0.0;
    
    // Out of bounds check
    if (index >= countTotal) {
        activePrevTexelSum = countTotal;
        return ivec2(-1, -1);
    }
    
    // Traverse down the mipmap hierarchy
    while (uv.z >= 1) {
        uv = ivec3(uv.xy * 2, uv.z - 1);
        
        float count00 = countActiveTexels(uv, ivec2(0, 0));
        float count01 = countActiveTexels(uv, ivec2(1, 0));
        float count10 = countActiveTexels(uv, ivec2(0, 1));
        
        float sum00 = activePrevTexelSum + count00;
        float sum01 = sum00 + count01;
        float sum10 = sum01 + count10;
        
        bool in00 = index < sum00;
        bool in01 = index < sum01;
        bool in10 = index < sum10;
        
        if (in00) {
            // Stay at (0,0)
        } else if (in01) {
            uv.xy += ivec2(1, 0);
            activePrevTexelSum += count00;
        } else if (in10) {
            uv.xy += ivec2(0, 1);
            activePrevTexelSum += count00 + count01;
        } else {
            uv.xy += ivec2(1, 1);
            activePrevTexelSum += count00 + count01 + count10;
        }
    }
    
    return uv.xy;
}

void main() {
    ivec2 pixel = ivec2(gl_FragCoord.xy);
    
    #ifdef OUTPUT_LINEAR
        // Linear index for output (simpler for consumers to read)
        uint index = uint(pixel.y) * uint(imageSize) + uint(pixel.x);
    #else
        // Morton index for internal passes (better cache locality)
        uint index = uvToIndex(pixel);
    #endif
    
    // Out of bounds check
    if (index >= uint(elementCount)) {
        pcFragColor0 = uvec4(0xFFFFFFFFu, 0u, 0u, 1u);
        pcFragColor1 = uvec4(0xFFFFFFFFu, 0u, 0u, 1u);
        return;
    }
    
    // Calculate prefix sum texture dimensions
    float prefixWidth = float(imageSize * (1 << (bitsPerStep >> 1))) / float(1 << (groupSize >> 1));
    
    // Binary search through mipmaps
    float count;
    ivec2 activePixel = activeTexelIndexToUV(prefixWidth, float(index), count);
    
    if (activePixel.x < 0) {
        pcFragColor0 = uvec4(0xFFFFFFFFu, 0u, 0u, 1u);
        pcFragColor1 = uvec4(0xFFFFFFFFu, 0u, 0u, 1u);
        return;
    }
    
    // Convert active pixel back to key index and digit
    uint activeIndex = uvToIndex(activePixel);
    uint elementsLog2 = uint(imageElementsLog2);
    uint groupsLog2 = elementsLog2 - uint(groupSize);
    uint digitIndex = activeIndex >> groupsLog2;
    uint keyIndex = (activeIndex - (digitIndex << groupsLog2)) << uint(groupSize);
    
    // Linear search within the group - optimized with integer math and incremental coords
    uint outKey = 0u;
    uint mask = (1u << uint(bitsPerStep)) - 1u;
    uint localIndexU = uint(float(index) - count);
    uint localCountU = 0u;
    uint foundMortonIndex = keyIndex;
    
    #ifdef SOURCE_LINEAR
        // Compute starting (x,y) once - only 1 div/mod instead of 16
        uint sw = uint(textureSize(keysTexture, 0).x);
        uint baseY = keyIndex / sw;
        uint baseX = keyIndex - baseY * sw;
        uint x = baseX;
        uint y = baseY;
        
        for (uint i = 0u; i < 16u; ++i) {
            ivec2 groupPixel = ivec2(int(x), int(y));
            outKey = texelFetch(keysTexture, groupPixel, 0).r;
            
            uint digit = (outKey >> uint(currentBit)) & mask;
            
            if (digit == digitIndex) {
                localCountU++;
                if (localCountU > localIndexU) {
                    foundMortonIndex = keyIndex + i;
                    break;
                }
            }
            
            // Advance to next pixel with wrap
            x++;
            if (x >= sw) {
                x = 0u;
                y++;
            }
        }
    #else
        // Morton layout - can't use simple x++ increment, but still use integer math
        for (uint i = 0u; i < 16u; ++i) {
            uint mortonIndex = keyIndex + i;
            ivec2 groupPixel = indexToUV(mortonIndex);
            outKey = texelFetch(keysTexture, groupPixel, 0).r;
            
            uint digit = (outKey >> uint(currentBit)) & mask;
            
            if (digit == digitIndex) {
                localCountU++;
                if (localCountU > localIndexU) {
                    foundMortonIndex = mortonIndex;
                    break;
                }
            }
        }
    #endif
    
    // Read indices after finding the match
    #ifdef FIRST_PASS
        // First pass: indices are implicitly [0,1,2,...], use index directly
        uint outIndex = foundMortonIndex;
    #else
        // Subsequent passes: read from shuffled indices texture
        ivec2 indicesPixel = indexToUV(foundMortonIndex);
        uint outIndex = texelFetch(indicesTexture, indicesPixel, 0).r;
    #endif
    
    // Output to two render targets (MRT): keys (uint) and indices (uint)
    pcFragColor0 = uvec4(outKey, 0u, 0u, 1u);
    pcFragColor1 = uvec4(outIndex, 0u, 0u, 1u);
}
`;
