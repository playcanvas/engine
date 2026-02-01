// Splat identification struct and helper - shared between rendering and processing contexts
export default /* wgsl */`

// Splat identification for texture sampling
struct Splat {
    index: u32,     // linear index into splat data
    uv: vec2i       // texture coordinate for sampling
}

// Global splat instance used by format read functions and load functions
var<private> splat: Splat;

// Initialize splat from linear index
fn setSplat(idx: u32) {
    splat.index = idx;
    splat.uv = vec2i(i32(idx % uniform.splatTextureSize), i32(idx / uniform.splatTextureSize));
}

`;
