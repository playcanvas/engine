// Tile classification: scans prefix-summed tile counts, builds radix/bitonic/large/rasterize
// tile lists, writes indirect dispatch args for subsequent passes, and writes indirect
// draw args for the tile-based composite.
// When USE_RADIX_SORT is defined: three sort tiers — radix (≤1976), bitonic (1977..4096),
// large (>4096 via bucket+chunk). Otherwise: two tiers — bitonic (≤4096), large (>4096).
// For large tiles, assigns compact overflow scratch offsets within the shared tileEntries
// buffer (overflow region starts at totalEntries).
// Single workgroup (256 threads) — each thread processes ceil(numTiles/256) tiles.
//
// tileListCounts layout:
//   [0] = bitonic tile count (smallTileList)
//   [1] = large tile count (largeTileList)
//   [2] = rasterize tile count (rasterizeTileList)
//   [3] = large tile overflow entries claimed
//   [4] = radix tile count (radixTileList) — only used when USE_RADIX_SORT is defined

import indirectCoreCS from '../common/comp/indirect-core.js';
import dispatchCoreCS from '../common/comp/dispatch-core.js';

export const computeGsplatLocalClassifySource = /* wgsl */`

${indirectCoreCS}
${dispatchCoreCS}

#ifdef USE_RADIX_SORT
const RADIX_MAX_ENTRIES: u32 = 1976u;
#endif
const BITONIC_MAX_ENTRIES: u32 = 4096u;
const CLASSIFY_WORKGROUP: u32 = 256u;

@group(0) @binding(0) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(1) var<storage, read_write> smallTileList: array<u32>;
@group(0) @binding(2) var<storage, read_write> largeTileList: array<u32>;
@group(0) @binding(3) var<storage, read_write> rasterizeTileList: array<u32>;
@group(0) @binding(4) var<storage, read_write> tileListCounts: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> indirectDispatchArgs: array<u32>;
@group(0) @binding(6) var<storage, read_write> largeTileOverflowBases: array<u32>;
@group(0) @binding(8) var<storage, read_write> indirectDrawArgs: array<DrawIndirectArgs>;
#ifdef USE_RADIX_SORT
@group(0) @binding(9) var<storage, read_write> radixTileList: array<u32>;
#endif

struct Uniforms {
    numTiles: u32,
    dispatchSlotOffset: u32,
    bufferCapacity: u32,
    maxWorkgroupsPerDim: u32,
    drawSlot: u32,
}
@group(0) @binding(7) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_index) localIdx: u32) {
    let numTiles = uniforms.numTiles;
    // Total tile entries from prefix sum — overflow scratch region starts here
    let totalEntries = tileSplatCounts[numTiles];

    for (var i: u32 = localIdx; i < numTiles; i += CLASSIFY_WORKGROUP) {
        let tStart = tileSplatCounts[i];
        let tEnd = tileSplatCounts[i + 1u];
        let count = tEnd - tStart;

        if (count == 0u || tEnd > uniforms.bufferCapacity) {
            continue;
        }

        let rIdx = atomicAdd(&tileListCounts[2], 1u);
        rasterizeTileList[rIdx] = i;

#ifdef USE_RADIX_SORT
        if (count <= RADIX_MAX_ENTRIES) {
            let rxIdx = atomicAdd(&tileListCounts[4], 1u);
            radixTileList[rxIdx] = i;
        } else if (count <= BITONIC_MAX_ENTRIES) {
#else
        if (count <= BITONIC_MAX_ENTRIES) {
#endif
            let sIdx = atomicAdd(&tileListCounts[0], 1u);
            smallTileList[sIdx] = i;
        } else {
            // Large tile: claim overflow scratch in the shared tileEntries buffer.
            // tileListCounts[3] tracks total overflow entries claimed across all large tiles.
            // Bucket sort checks bounds and skips tiles whose overflow exceeds capacity.
            let overflowOffset = atomicAdd(&tileListCounts[3], count);
            let lIdx = atomicAdd(&tileListCounts[1], 1u);
            largeTileList[lIdx] = i;
            largeTileOverflowBases[lIdx] = totalEntries + overflowOffset;
        }
    }

    workgroupBarrier();

    // Thread 0 writes indirect dispatch args for sort and rasterize passes.
    // Uses balanced 2D dispatch to stay within maxComputeWorkgroupsPerDimension with minimal waste:
    // y = ceil(count / maxDim), x = ceil(count / y). Waste is at most y-1 workgroups (typically 0-1).
    if (localIdx == 0u) {
        let bitonicCount = atomicLoad(&tileListCounts[0]);
        let largeCount = atomicLoad(&tileListCounts[1]);
        let rasterizeCount = atomicLoad(&tileListCounts[2]);
        let off = uniforms.dispatchSlotOffset;
        let maxDim = uniforms.maxWorkgroupsPerDim;

        // Slot 0: bitonic tile sort
        let bitonicDim = calcDispatch2D(bitonicCount, maxDim);
        indirectDispatchArgs[off + 0u] = bitonicDim.x;
        indirectDispatchArgs[off + 1u] = bitonicDim.y;
        indirectDispatchArgs[off + 2u] = 1u;

        // Slot 1: bucket pre-sort — 1 workgroup per large tile
        let largeDim = calcDispatch2D(largeCount, maxDim);
        indirectDispatchArgs[off + 3u] = largeDim.x;
        indirectDispatchArgs[off + 4u] = largeDim.y;
        indirectDispatchArgs[off + 5u] = 1u;

        // Slot 2: rasterize — 1 workgroup per non-empty tile
        let rasterDim = calcDispatch2D(rasterizeCount, maxDim);
        indirectDispatchArgs[off + 6u] = rasterDim.x;
        indirectDispatchArgs[off + 7u] = rasterDim.y;
        indirectDispatchArgs[off + 8u] = 1u;

#ifdef USE_RADIX_SORT
        // Slot 3: radix tile sort (≤1976 entries)
        let radixCount = atomicLoad(&tileListCounts[4]);
        let radixDim = calcDispatch2D(radixCount, maxDim);
        indirectDispatchArgs[off + 9u] = radixDim.x;
        indirectDispatchArgs[off + 10u] = radixDim.y;
        indirectDispatchArgs[off + 11u] = 1u;
#endif

        // Indirect draw args for tile-based composite: 6 vertices per tile quad
        indirectDrawArgs[uniforms.drawSlot] = DrawIndirectArgs(rasterizeCount * 6u, 1u, 0u, 0u, 0u);
    }
}
`;
