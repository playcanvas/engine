// Writes chunk sort indirect dispatch args. This must be a separate compute pass so the
// implicit inter-pass barrier in WebGPU guarantees that:
//   - All bucket sort writes to tileEntries, totalChunks and chunkRanges (previous pass)
//     are visible here.
//   - The chunkSortIndirect args written here are visible to the chunk sort (next pass).
// Clamps the count to maxChunks (matching the chunkRanges buffer budget) and writes a 2D
// dispatch to stay within maxComputeWorkgroupsPerDimension.

import dispatchCoreCS from '../common/comp/dispatch-core.js';

export const computeGsplatLocalCopySource = /* wgsl */`

${dispatchCoreCS}

@group(0) @binding(0) var<storage, read> totalChunks: array<u32>;
@group(0) @binding(1) var<storage, read_write> chunkSortIndirect: array<u32>;

struct Uniforms {
    maxChunks: u32,
    maxWorkgroupsPerDim: u32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(1)
fn main() {
    let count = min(totalChunks[0], uniforms.maxChunks);
    let dim = calcDispatch2D(count, uniforms.maxWorkgroupsPerDim);
    chunkSortIndirect[0] = dim.x;
    chunkSortIndirect[1] = dim.y;
    chunkSortIndirect[2] = 1u;
}
`;
