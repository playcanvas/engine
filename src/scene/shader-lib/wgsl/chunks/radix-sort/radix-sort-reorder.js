// Binary search reorder shader - Pass 1 of radix sort
// Uses mipmap traversal for O(log n) lookup instead of O(n) linear search
// MRT version: reads from keys + indices textures, writes to two outputs
//
// Variants:
// - SOURCE_LINEAR: Read from linear-layout source texture (first pass)
// - (default): Read from Morton-layout internal texture (subsequent passes)
export default /* wgsl */`
var keysTexture: texture_2d<u32>;
#ifdef SOURCE_LINEAR
    #define FIRST_PASS
#else
    var indicesTexture: texture_2d<u32>;
#endif

var prefixSums: texture_2d<f32>;

uniform bitsPerStep: i32;
uniform groupSize: i32;
uniform elementCount: i32;
uniform imageElementsLog2: i32;
uniform currentBit: i32;
uniform imageSize: i32;

varying uv0: vec2f;

// Morton code functions for Z-order curve indexing
fn interleaveWithZero(word_in: u32) -> u32 {
    var word = word_in;
    word = (word ^ (word << 8u)) & 0x00ff00ffu;
    word = (word ^ (word << 4u)) & 0x0f0f0f0fu;
    word = (word ^ (word << 2u)) & 0x33333333u;
    word = (word ^ (word << 1u)) & 0x55555555u;
    return word;
}

fn deinterleaveWithZero(word_in: u32) -> u32 {
    var word = word_in & 0x55555555u;
    word = (word | (word >> 1u)) & 0x33333333u;
    word = (word | (word >> 2u)) & 0x0f0f0f0fu;
    word = (word | (word >> 4u)) & 0x00ff00ffu;
    word = (word | (word >> 8u)) & 0x0000ffffu;
    return word;
}

fn indexToUV(index: u32) -> vec2i {
    return vec2i(i32(deinterleaveWithZero(index)), i32(deinterleaveWithZero(index >> 1u)));
}

fn uvToIndex(uv: vec2i) -> u32 {
    return interleaveWithZero(u32(uv.x)) | (interleaveWithZero(u32(uv.y)) << 1u);
}

// Count active texels at a given mip level
// Uses bit shift instead of pow() for performance
fn countActiveTexels(uv: vec3i, offset: vec2i) -> f32 {
    // 4^level = 2^(level*2) = 1 << (level * 2)
    let scale = f32(1u << (u32(uv.z) * 2u));
    return scale * textureLoad(prefixSums, uv.xy + offset, uv.z).r;
}

// Binary search result structure
struct BinarySearchResult {
    pixel: vec2i,
    prefixSum: f32
}

// Binary search through the mipmap hierarchy
fn activeTexelIndexToUV(prefixWidth: f32, index: f32) -> BinarySearchResult {
    var result: BinarySearchResult;
    
    let maxLod = i32(round(log2(prefixWidth)));
    var uv = vec3i(0, 0, maxLod);
    
    let countTotal = countActiveTexels(uv, vec2i(0, 0));
    result.prefixSum = 0.0;
    
    if (index >= countTotal) {
        result.prefixSum = countTotal;
        result.pixel = vec2i(-1, -1);
        return result;
    }
    
    while (uv.z >= 1) {
        uv = vec3i(uv.xy * 2, uv.z - 1);
        
        let count00 = countActiveTexels(uv, vec2i(0, 0));
        let count01 = countActiveTexels(uv, vec2i(1, 0));
        let count10 = countActiveTexels(uv, vec2i(0, 1));
        
        let in00 = index < (result.prefixSum + count00);
        let in01 = index < (result.prefixSum + count00 + count01);
        let in10 = index < (result.prefixSum + count00 + count01 + count10);
        
        if (in00) {
            // Stay at (0,0)
        } else if (in01) {
            uv = vec3i(uv.x + 1, uv.y, uv.z);
            result.prefixSum += count00;
        } else if (in10) {
            uv = vec3i(uv.x, uv.y + 1, uv.z);
            result.prefixSum += count00 + count01;
        } else {
            uv = vec3i(uv.x + 1, uv.y + 1, uv.z);
            result.prefixSum += count00 + count01 + count10;
        }
    }
    
    result.pixel = uv.xy;
    return result;
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    
    let pixel = vec2i(input.position.xy);
    
    #ifdef OUTPUT_LINEAR
        // Linear index for output (simpler for consumers to read)
        let index = u32(pixel.y) * u32(uniform.imageSize) + u32(pixel.x);
    #else
        // Morton index for internal passes (better cache locality)
        let index = uvToIndex(pixel);
    #endif
    
    if (index >= u32(uniform.elementCount)) {
        output.color = vec4u(0xFFFFFFFFu, 0u, 0u, 1u);
        output.color1 = vec4u(0xFFFFFFFFu, 0u, 0u, 1u);
        return output;
    }
    
    let prefixWidth = f32(uniform.imageSize * (1i << u32(uniform.bitsPerStep >> 1))) / f32(1i << u32(uniform.groupSize >> 1));
    let searchResult = activeTexelIndexToUV(prefixWidth, f32(index));
    
    if (searchResult.pixel.x < 0) {
        output.color = vec4u(0xFFFFFFFFu, 0u, 0u, 1u);
        output.color1 = vec4u(0xFFFFFFFFu, 0u, 0u, 1u);
        return output;
    }
    
    let activeIndex = uvToIndex(searchResult.pixel);
    let elementsLog2 = u32(uniform.imageElementsLog2);
    let groupsLog2 = elementsLog2 - u32(uniform.groupSize);
    let digitIndex = activeIndex >> groupsLog2;
    let keyIndex = (activeIndex - (digitIndex << groupsLog2)) << u32(uniform.groupSize);
    
    // Linear search within the group - optimized with integer math and incremental coords
    var outKey: u32 = 0u;
    let mask = (1u << u32(uniform.bitsPerStep)) - 1u;
    let localIndexU = u32(f32(index) - searchResult.prefixSum);
    var localCountU: u32 = 0u;
    var foundMortonIndex: u32 = keyIndex;
    
    #ifdef SOURCE_LINEAR
        // Compute starting (x,y) once - only 1 div/mod instead of 16
        let sw = textureDimensions(keysTexture, 0).x;
        let baseY = keyIndex / sw;
        let baseX = keyIndex - baseY * sw;
        var x = baseX;
        var y = baseY;
        
        for (var i: u32 = 0u; i < 16u; i = i + 1u) {
            let groupPixel = vec2i(i32(x), i32(y));
            outKey = textureLoad(keysTexture, groupPixel, 0).r;
            
            let digit = (outKey >> u32(uniform.currentBit)) & mask;
            
            if (digit == digitIndex) {
                localCountU = localCountU + 1u;
                if (localCountU > localIndexU) {
                    foundMortonIndex = keyIndex + i;
                    break;
                }
            }
            
            // Advance to next pixel with wrap
            x = x + 1u;
            if (x >= sw) {
                x = 0u;
                y = y + 1u;
            }
        }
    #else
        // Morton layout - can't use simple x++ increment, but still use integer math
        for (var i: u32 = 0u; i < 16u; i = i + 1u) {
            let mortonIndex = keyIndex + i;
            let groupPixel = indexToUV(mortonIndex);
            outKey = textureLoad(keysTexture, groupPixel, 0).r;
            
            let digit = (outKey >> u32(uniform.currentBit)) & mask;
            
            if (digit == digitIndex) {
                localCountU = localCountU + 1u;
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
        let outIndex = foundMortonIndex;
    #else
        // Subsequent passes: read from shuffled indices texture
        let indicesPixel = indexToUV(foundMortonIndex);
        let outIndex = textureLoad(indicesTexture, indicesPixel, 0).r;
    #endif
    
    output.color = vec4u(outKey, 0u, 0u, 1u);
    output.color1 = vec4u(outIndex, 0u, 0u, 1u);
    return output;
}
`;
