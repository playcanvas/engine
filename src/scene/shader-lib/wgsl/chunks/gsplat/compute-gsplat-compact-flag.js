// Compute shader for the flag pass of prefix-sum based stream compaction.
//
// Writes a 0/1 visibility flag per splat into flagBuffer[0..N-1], plus a sentinel
// flagBuffer[N] = 0. After an exclusive prefix sum over the N+1 elements:
//
//   - prefixSum[i] gives the output index for splat i (if visible)
//   - prefixSum[i] != prefixSum[i+1] means splat i was visible
//   - prefixSum[N] equals the total number of visible splats
//
// Each thread processes multiple splats by striding through the array at intervals
// equal to the total thread count. This ensures adjacent threads always access
// consecutive memory addresses (enabling coalesced reads), while giving each thread
// multiple independent splats to overlap memory latency.
//
// When USE_SORTED_ORDER is defined, the shader reads sortedOrder[i] to get the
// splatId for the pcNodeIndex lookup (post-sort CPU path, order-preserving).
// Otherwise splatId = i (pre-sort GPU path).

export const computeGsplatCompactFlagSource = /* wgsl */`

// Uniforms
struct FlagUniforms {
    totalSplats: u32,
    textureWidth: u32,
    visWidth: u32,
    totalThreads: u32,
    numWorkgroupsX: u32
};
@group(0) @binding(0) var<uniform> uniforms: FlagUniforms;

// Work buffer texture containing per-splat node index (R32U)
@group(0) @binding(1) var pcNodeIndex: texture_2d<u32>;

// Bit-packed node visibility texture (R32U, 32 spheres per texel)
@group(0) @binding(2) var nodeVisibilityTexture: texture_2d<u32>;

// Output: 0/1 flags per splat, plus sentinel at index N
@group(0) @binding(3) var<storage, read_write> flagBuffer: array<u32>;

#ifdef USE_SORTED_ORDER
// Sorted order buffer (CPU sort results): sortedOrder[i] gives the splatId
@group(0) @binding(4) var<storage, read> sortedOrder: array<u32>;
#endif

@compute @workgroup_size({WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let totalSplats = uniforms.totalSplats;
    let texW = uniforms.textureWidth;
    let visW = uniforms.visWidth;
    let stride = uniforms.totalThreads;

    // Compute flat thread ID from 2D dispatch grid
    let threadId = gid.x + gid.y * uniforms.numWorkgroupsX * {WORKGROUP_SIZE}u;

    // Each thread processes multiple splats at stride intervals.
    // This preserves warp-level coalescing (adjacent threads access adjacent indices)
    // while allowing ILP across independent splat computations within each thread.
    for (var idx = threadId; idx < totalSplats; idx += stride) {

        // Determine splatId: either from sorted order (CPU path) or directly (GPU path)
        #ifdef USE_SORTED_ORDER
            let splatId = sortedOrder[idx];
        #else
            let splatId = idx;
        #endif

        // Read pcNodeIndex from work buffer texture
        let uv = vec2i(i32(splatId % texW), i32(splatId / texW));
        let nodeIdx = textureLoad(pcNodeIndex, uv, 0).r;

        // Check visibility bit from bit-packed texture
        let texelIdx = nodeIdx >> 5u;
        let bitIdx = nodeIdx & 31u;
        let visCoord = vec2i(i32(texelIdx % visW), i32(texelIdx / visW));
        let visBits = textureLoad(nodeVisibilityTexture, visCoord, 0).r;

        flagBuffer[idx] = select(0u, 1u, (visBits & (1u << bitIdx)) != 0u);
    }

    // Write sentinel: flagBuffer[N] = 0 (ensures prefixSum[N] equals the total visible
    // count and lets the scatter pass safely read prefixSum[i+1] for the last element).
    // Only thread 0 writes the sentinel.
    if (threadId == 0u) {
        flagBuffer[totalSplats] = 0u;
    }
}
`;

export default computeGsplatCompactFlagSource;
