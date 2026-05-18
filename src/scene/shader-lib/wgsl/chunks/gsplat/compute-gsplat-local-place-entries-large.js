// Cooperative large-splat place-entries pass: one workgroup (256 threads) per large splat.
//
// The regular PlaceEntries pass skips large splats (flagged via the high bit of
// splatPairCount). This pass picks them up and spreads each splat's pair writes across
// 256 threads, eliminating the long tail caused by single threads looping over hundreds
// of pairs with scattered tileEntries writes.
//
// Reuses the same largeSplatIds buffer and indirect dispatch dimensions as
// LargeTileCount — one workgroup per large splat.
export const computeGsplatLocalPlaceEntriesLargeSource = /* wgsl */`

const WG_SIZE: u32 = 256u;

@group(0) @binding(0) var<storage, read> pairBuffer: array<u32>;
@group(0) @binding(1) var<storage, read> splatPairStart: array<u32>;
@group(0) @binding(2) var<storage, read> splatPairCount: array<u32>;
@group(0) @binding(3) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(4) var<storage, read_write> tileEntries: array<u32>;
@group(0) @binding(5) var<storage, read> largeSplatIds: array<u32>;
@group(0) @binding(6) var<storage, read> countersBuffer: array<u32>;

@compute @workgroup_size(256)
fn main(
    @builtin(workgroup_id) wgId: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u,
    @builtin(local_invocation_index) lid: u32
) {
    let largeSplatIdx = wgId.y * numWorkgroups.x + wgId.x;
    let numLarge = min(countersBuffer[1], arrayLength(&largeSplatIds));
    if (largeSplatIdx >= numLarge) {
        return;
    }

    let threadIdx = largeSplatIds[largeSplatIdx];
    let pairCount = splatPairCount[threadIdx] & 0x7FFFFFFFu;
    if (pairCount == 0u) {
        return;
    }

    let start = splatPairStart[threadIdx];
    let pairLen = arrayLength(&pairBuffer);
    let tileEntriesLen = arrayLength(&tileEntries);

    for (var j = lid; j < pairCount; j += WG_SIZE) {
        let pairIdx = start + j;
        if (pairIdx >= pairLen) { break; }

        let packed = pairBuffer[pairIdx];
        let tileIdx = packed >> 16u;
        let localOff = packed & 0xFFFFu;

        let entryIdx = tileSplatCounts[tileIdx] + localOff;
        if (entryIdx < tileEntriesLen) {
            tileEntries[entryIdx] = threadIdx;
        }
    }
}
`;
