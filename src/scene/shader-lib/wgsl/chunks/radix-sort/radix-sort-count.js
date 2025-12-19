// Count digits shader - Pass 0 of radix sort
// Counts how many elements in each group have a specific digit value
//
// Variants:
// - SOURCE_LINEAR: Read from linear-layout source texture (first pass)
// - (default): Read from Morton-layout internal texture (subsequent passes)
export default /* wgsl */`
var keysTexture: texture_2d<u32>;

uniform bitsPerStep: i32;
uniform groupSize: i32;
uniform elementCount: i32;
uniform imageElementsLog2: i32;
uniform currentBit: i32;

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

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    
    // Get current pixel position
    let pixel = vec2i(input.position.xy);
    let morton = uvToIndex(pixel);
    
    // Calculate which digit and which group this pixel represents
    let elementsLog2 = u32(uniform.imageElementsLog2);
    let groupsLog2 = elementsLog2 - u32(uniform.groupSize);
    let digitIndex = morton >> groupsLog2;
    let keyIndex = (morton - (digitIndex << groupsLog2)) << u32(uniform.groupSize);
    let elemCount = u32(uniform.elementCount);
    
    // Out of bounds check - this group starts past valid data
    if (keyIndex >= elemCount) {
        output.color = 0.0;
        return output;
    }
    
    // Setup variables for quad processing
    var count: u32 = 0u;
    let mask = (1u << u32(uniform.bitsPerStep)) - 1u;
    let cBit = u32(uniform.currentBit);
    let digitIdx4 = vec4u(digitIndex);
    let mask4 = vec4u(mask);
    let elemCount4 = vec4u(elemCount);
    let QUAD_OFFSETS = vec4u(0u, 1u, 2u, 3u);
    
    // Check if this is a partial group (last group that extends past elementCount)
    let isPartialGroup = (keyIndex + 16u) > elemCount;
    
    #ifdef SOURCE_LINEAR
        let sw = i32(textureDimensions(keysTexture, 0).x);
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
    output.color = f32(count);
    return output;
}
`;
