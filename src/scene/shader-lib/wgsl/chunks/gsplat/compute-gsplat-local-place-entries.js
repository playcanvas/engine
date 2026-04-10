// Lightweight place-entries pass: reads (tileIdx, localOffset) pairs written by the
// count+pair-write pass and places splat indices into per-tile entry lists using the
// prefix-summed tile offsets.
//
// Dispatched per-splat (same shape as the count pass). Each thread reads its pair range
// via splatPairStart/splatPairCount and writes to tileEntries at deterministic positions.
export const computeGsplatLocalPlaceEntriesSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> pairBuffer: array<u32>;
@group(0) @binding(1) var<storage, read> splatPairStart: array<u32>;
@group(0) @binding(2) var<storage, read> splatPairCount: array<u32>;
@group(0) @binding(3) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(4) var<storage, read_write> tileEntries: array<u32>;
@group(0) @binding(5) var<storage, read> sortElementCount: array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) numWorkgroups: vec3u) {
    let threadIdx = gid.y * (numWorkgroups.x * 256u) + gid.x;
    let numVisible = sortElementCount[0];
    if (threadIdx >= numVisible) {
        return;
    }

    let rawCount = splatPairCount[threadIdx];
    // High bit marks large splats handled by the cooperative LargePlaceEntries pass
    if (rawCount == 0u || (rawCount & 0x80000000u) != 0u) {
        return;
    }
    let count = rawCount;

    let start = splatPairStart[threadIdx];
    let pairLen = arrayLength(&pairBuffer);
    let tileEntriesLen = arrayLength(&tileEntries);

    for (var j: u32 = 0u; j < count; j++) {
        let pairIdx = start + j;
        if (pairIdx >= pairLen) { break; }

        let packed = pairBuffer[pairIdx];
        let tileIdx = packed >> 16u;
        let localOff = packed & 0xFFFFu;

        // tileSplatCounts has been prefix-summed, so it holds the start offset for each tile.
        // localOff is the within-tile position assigned by atomicAdd during the count pass.
        let entryIdx = tileSplatCounts[tileIdx] + localOff;
        if (entryIdx < tileEntriesLen) {
            tileEntries[entryIdx] = threadIdx;
        }
    }
}
`;
