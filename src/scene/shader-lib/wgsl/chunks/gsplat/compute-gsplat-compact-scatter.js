// Compute shader for the scatter pass of prefix-sum based stream compaction.
//
// The scatter pass is the final step of stream compaction. Its job is to take
// sparse visible elements and pack them into a dense contiguous output array.
// Each thread checks whether its element was visible, and if so, writes its
// splat ID to the output at the position determined by the prefix sum.
//
// After the flag pass wrote 0/1 flags and the prefix sum converted them in-place
// to an exclusive scan, the buffer (now called prefixSum) has this property:
//
//   index:       0  1  2  3  4  5  (N=6, sentinel)
//   flags:       1  0  1  1  0  1  0
//   prefixSum:   0  1  1  2  3  3  4
//
// To check if element i was visible:
//   prefixSum[i] != prefixSum[i + 1]
//
// This works because the exclusive prefix sum increments only at positions where
// the original flag was 1. The sentinel at index N ensures this is safe for the
// last real element. prefixSum[i] directly gives the output index for visible
// elements.
//
// The result is a tightly packed compactedOutput array containing only visible
// splat IDs, which downstream passes (sort key generation, rendering) can
// iterate without gaps.
//
// When USE_SORTED_ORDER is defined, reads sortedOrder[i] as the splatId
// (post-sort CPU path, preserving sort order). Otherwise splatId = i.

export const computeGsplatCompactScatterSource = /* wgsl */`

// Uniforms
struct ScatterUniforms {
    totalSplats: u32,
    numWorkgroupsX: u32,
    pad1: u32,
    pad2: u32
};
@group(0) @binding(0) var<uniform> uniforms: ScatterUniforms;

// Prefix sum buffer (was flagBuffer, now contains exclusive scan results)
@group(0) @binding(1) var<storage, read> prefixSumBuffer: array<u32>;

// Output: compacted visible splat IDs
@group(0) @binding(2) var<storage, read_write> compactedOutput: array<u32>;

#ifdef USE_SORTED_ORDER
// Sorted order buffer (CPU sort results): sortedOrder[i] gives the splatId
@group(0) @binding(3) var<storage, read> sortedOrder: array<u32>;
#endif

@compute @workgroup_size({WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x + gid.y * uniforms.numWorkgroupsX * {WORKGROUP_SIZE}u;
    if (i >= uniforms.totalSplats) { return; }

    // Element was visible if the prefix sum increments at this position.
    // Since the prefix sum is exclusive, prefixSum[i+1] - prefixSum[i] == original flag[i].
    let outIdx = prefixSumBuffer[i];
    let nextIdx = prefixSumBuffer[i + 1u];
    if (outIdx == nextIdx) { return; }  // flag was 0, element was culled

    // Determine splatId: either from sorted order (CPU path) or directly (GPU path)
    #ifdef USE_SORTED_ORDER
    let splatId = sortedOrder[i];
    #else
    let splatId = i;
    #endif

    compactedOutput[outIdx] = splatId;
}
`;

export default computeGsplatCompactScatterSource;
