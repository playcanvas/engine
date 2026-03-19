// Writes chunk sort indirect dispatch args. This must be a separate compute pass so the
// implicit inter-pass barrier in WebGPU guarantees that:
//   - All bucket sort writes to tileEntries, totalChunks and chunkRanges (previous pass)
//     are visible here.
//   - The chunkSortIndirect args written here are visible to the chunk sort (next pass).
export const computeGsplatLocalCopySource = /* wgsl */`

@group(0) @binding(0) var<storage, read> totalChunks: array<u32>;
@group(0) @binding(1) var<storage, read_write> chunkSortIndirect: array<u32>;

@compute @workgroup_size(1)
fn main() {
    chunkSortIndirect[0] = totalChunks[0];
    chunkSortIndirect[1] = 1u;
    chunkSortIndirect[2] = 1u;
}
`;
