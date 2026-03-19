// Chunk sort: bitonic sort for chunks of large-tile entries produced by bucket pre-sort.
// Each workgroup reads (start, count) from chunkRanges and calls the shared bitonic sort.
// tileEntries already contains the bucket-sorted data (copied by a prior pass).
export const computeGsplatLocalChunkSortSource = /* wgsl */`

#include "gsplatLocalBitonicCS"

@group(0) @binding(0) var<storage, read_write> tileEntries: array<u32>;
@group(0) @binding(1) var<storage, read> projCache: array<u32>;
@group(0) @binding(2) var<storage, read> chunkRanges: array<u32>;

@compute @workgroup_size(256)
fn main(
    @builtin(local_invocation_index) localIdx: u32,
    @builtin(workgroup_id) wid: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u
) {
    let chunkIdx = wid.y * numWorkgroups.x + wid.x;
    let tStart = chunkRanges[chunkIdx * 2u];
    let count = chunkRanges[chunkIdx * 2u + 1u];
    bitonicSortRange(localIdx, tStart, count);
}
`;
