// Writes chunk sort indirect dispatch args. This must be a separate compute pass so the
// implicit inter-pass barrier in WebGPU guarantees that:
//   - All bucket sort writes to tileEntries, totalChunks and chunkRanges (previous pass)
//     are visible here.
//   - The chunkSortIndirect args written here are visible to the chunk sort (next pass).
// Clamps the count to maxChunks (matching the chunkRanges buffer budget) and writes a 2D
// dispatch to stay within maxComputeWorkgroupsPerDimension.
export const computeGsplatLocalCopySource = /* wgsl */`

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
    let maxDim = uniforms.maxWorkgroupsPerDim;
    chunkSortIndirect[0] = min(count, maxDim);
    chunkSortIndirect[1] = (count + maxDim - 1u) / maxDim;
    chunkSortIndirect[2] = 1u;
}
`;
