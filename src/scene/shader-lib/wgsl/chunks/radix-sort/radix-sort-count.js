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
    
    // Out of bounds check
    if (keyIndex >= u32(uniform.elementCount)) {
        output.color = 0.0;
        return output;
    }
    
    // Count how many elements in this group have the target digit
    // Vectorized: process 4 elements at a time using vec4u
    var count: u32 = 0u;
    let mask = (1u << u32(uniform.bitsPerStep)) - 1u;
    let cBit = u32(uniform.currentBit);
    let digitIdx4 = vec4u(digitIndex);
    let mask4 = vec4u(mask);
    let QUAD_OFFSETS = vec4u(0u, 1u, 2u, 3u);
    
    #ifdef SOURCE_LINEAR
        let sw = i32(textureDimensions(keysTexture, 0).x);
        
        // Quad 0-3
        var mi4 = keyIndex + QUAD_OFFSETS;
        var y4 = vec4i(mi4) / sw;
        var x4 = vec4i(mi4) - y4 * sw;
        var keys = vec4u(
            textureLoad(keysTexture, vec2i(x4.x, y4.x), 0).r,
            textureLoad(keysTexture, vec2i(x4.y, y4.y), 0).r,
            textureLoad(keysTexture, vec2i(x4.z, y4.z), 0).r,
            textureLoad(keysTexture, vec2i(x4.w, y4.w), 0).r
        );
        var digits = (keys >> vec4u(cBit)) & mask4;
        var m4 = select(vec4u(0u), vec4u(1u), digits == digitIdx4);
        count += m4.x + m4.y + m4.z + m4.w;

        // Quad 4-7
        mi4 = (keyIndex + 4u) + QUAD_OFFSETS;
        y4 = vec4i(mi4) / sw;
        x4 = vec4i(mi4) - y4 * sw;
        keys = vec4u(
            textureLoad(keysTexture, vec2i(x4.x, y4.x), 0).r,
            textureLoad(keysTexture, vec2i(x4.y, y4.y), 0).r,
            textureLoad(keysTexture, vec2i(x4.z, y4.z), 0).r,
            textureLoad(keysTexture, vec2i(x4.w, y4.w), 0).r
        );
        digits = (keys >> vec4u(cBit)) & mask4;
        m4 = select(vec4u(0u), vec4u(1u), digits == digitIdx4);
        count += m4.x + m4.y + m4.z + m4.w;

        // Quad 8-11
        mi4 = (keyIndex + 8u) + QUAD_OFFSETS;
        y4 = vec4i(mi4) / sw;
        x4 = vec4i(mi4) - y4 * sw;
        keys = vec4u(
            textureLoad(keysTexture, vec2i(x4.x, y4.x), 0).r,
            textureLoad(keysTexture, vec2i(x4.y, y4.y), 0).r,
            textureLoad(keysTexture, vec2i(x4.z, y4.z), 0).r,
            textureLoad(keysTexture, vec2i(x4.w, y4.w), 0).r
        );
        digits = (keys >> vec4u(cBit)) & mask4;
        m4 = select(vec4u(0u), vec4u(1u), digits == digitIdx4);
        count += m4.x + m4.y + m4.z + m4.w;

        // Quad 12-15
        mi4 = (keyIndex + 12u) + QUAD_OFFSETS;
        y4 = vec4i(mi4) / sw;
        x4 = vec4i(mi4) - y4 * sw;
        keys = vec4u(
            textureLoad(keysTexture, vec2i(x4.x, y4.x), 0).r,
            textureLoad(keysTexture, vec2i(x4.y, y4.y), 0).r,
            textureLoad(keysTexture, vec2i(x4.z, y4.z), 0).r,
            textureLoad(keysTexture, vec2i(x4.w, y4.w), 0).r
        );
        digits = (keys >> vec4u(cBit)) & mask4;
        m4 = select(vec4u(0u), vec4u(1u), digits == digitIdx4);
        count += m4.x + m4.y + m4.z + m4.w;
    #else
        // Quad 0-3
        var mi4 = keyIndex + QUAD_OFFSETS;
        var keys = vec4u(
            textureLoad(keysTexture, indexToUV(mi4.x), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.y), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.z), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.w), 0).r
        );
        var digits = (keys >> vec4u(cBit)) & mask4;
        var m4 = select(vec4u(0u), vec4u(1u), digits == digitIdx4);
        count += m4.x + m4.y + m4.z + m4.w;

        // Quad 4-7
        mi4 = (keyIndex + 4u) + QUAD_OFFSETS;
        keys = vec4u(
            textureLoad(keysTexture, indexToUV(mi4.x), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.y), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.z), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.w), 0).r
        );
        digits = (keys >> vec4u(cBit)) & mask4;
        m4 = select(vec4u(0u), vec4u(1u), digits == digitIdx4);
        count += m4.x + m4.y + m4.z + m4.w;

        // Quad 8-11
        mi4 = (keyIndex + 8u) + QUAD_OFFSETS;
        keys = vec4u(
            textureLoad(keysTexture, indexToUV(mi4.x), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.y), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.z), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.w), 0).r
        );
        digits = (keys >> vec4u(cBit)) & mask4;
        m4 = select(vec4u(0u), vec4u(1u), digits == digitIdx4);
        count += m4.x + m4.y + m4.z + m4.w;

        // Quad 12-15
        mi4 = (keyIndex + 12u) + QUAD_OFFSETS;
        keys = vec4u(
            textureLoad(keysTexture, indexToUV(mi4.x), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.y), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.z), 0).r,
            textureLoad(keysTexture, indexToUV(mi4.w), 0).r
        );
        digits = (keys >> vec4u(cBit)) & mask4;
        m4 = select(vec4u(0u), vec4u(1u), digits == digitIdx4);
        count += m4.x + m4.y + m4.z + m4.w;
    #endif
    
    // Output the count as raw float (R32F format)
    output.color = f32(count);
    return output;
}
`;
