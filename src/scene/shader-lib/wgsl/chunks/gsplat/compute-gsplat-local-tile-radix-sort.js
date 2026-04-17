// Per-tile radix sort for tiles with up to 1976 entries.
// Reads tile index from radixTileList and delegates to the shared radix sort logic.
// Requires subgroup support for stable scatter.
export const computeGsplatLocalTileRadixSortSource = /* wgsl */`

#include "gsplatLocalRadixSortCS"

@group(0) @binding(0) var<storage, read_write> tileEntries: array<u32>;
@group(0) @binding(1) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(2) var<storage, read> depthBuffer: array<u32>;
@group(0) @binding(3) var<storage, read> radixTileList: array<u32>;
@group(0) @binding(4) var<storage, read> tileListCounts: array<u32>;

@compute @workgroup_size(256)
fn main(
    @builtin(local_invocation_index) localIdx: u32,
    @builtin(workgroup_id) wid: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u,
    @builtin(subgroup_invocation_id) sgInvId: u32,
    @builtin(subgroup_size) sgSize: u32
) {
    let workgroupIdx = wid.y * numWorkgroups.x + wid.x;
    if (workgroupIdx >= tileListCounts[4]) {
        return;
    }
    let tileIdx = radixTileList[workgroupIdx];
    let tStart = tileSplatCounts[tileIdx];
    let tEnd = tileSplatCounts[tileIdx + 1u];
    let count = tEnd - tStart;

    radixSortRange(localIdx, sgInvId, sgSize, tStart, count);
}
`;
