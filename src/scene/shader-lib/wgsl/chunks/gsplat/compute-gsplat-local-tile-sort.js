// Per-tile bitonic sort for small tiles (1..4096 entries).
// Reads tile index from smallTileList and delegates to the shared bitonic sort logic.
export const computeGsplatLocalTileSortSource = /* wgsl */`

#include "gsplatLocalBitonicCS"

@group(0) @binding(0) var<storage, read_write> tileEntries: array<u32>;
@group(0) @binding(1) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(2) var<storage, read> depthBuffer: array<u32>;
@group(0) @binding(3) var<storage, read> smallTileList: array<u32>;
@group(0) @binding(4) var<storage, read> tileListCounts: array<u32>;

@compute @workgroup_size(256)
fn main(
    @builtin(local_invocation_index) localIdx: u32,
    @builtin(workgroup_id) wid: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u
) {
    let workgroupIdx = wid.y * numWorkgroups.x + wid.x;
    if (workgroupIdx >= tileListCounts[0]) {
        return;
    }
    let tileIdx = smallTileList[workgroupIdx];
    let tStart = tileSplatCounts[tileIdx];
    let tEnd = tileSplatCounts[tileIdx + 1u];
    let count = tEnd - tStart;

    bitonicSortRange(localIdx, tStart, count);
}
`;
