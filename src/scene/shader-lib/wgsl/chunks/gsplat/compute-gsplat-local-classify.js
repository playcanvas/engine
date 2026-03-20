// Tile classification: scans prefix-summed tile counts, builds small/large/rasterize
// tile lists, writes indirect dispatch args for subsequent passes, and writes indirect
// draw args for the tile-based composite.
// For large tiles (>4096 entries), assigns compact overflow scratch offsets within
// the shared tileEntries buffer (overflow region starts at totalEntries).
// Single workgroup (256 threads) — each thread processes ceil(numTiles/256) tiles.

import indirectCoreCS from '../common/comp/indirect-core.js';

export const computeGsplatLocalClassifySource = /* wgsl */`

${indirectCoreCS}

const MAX_TILE_ENTRIES: u32 = 4096u;
const CLASSIFY_WORKGROUP: u32 = 256u;

@group(0) @binding(0) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(1) var<storage, read_write> smallTileList: array<u32>;
@group(0) @binding(2) var<storage, read_write> largeTileList: array<u32>;
@group(0) @binding(3) var<storage, read_write> rasterizeTileList: array<u32>;
@group(0) @binding(4) var<storage, read_write> tileListCounts: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> indirectDispatchArgs: array<u32>;
@group(0) @binding(6) var<storage, read_write> largeTileOverflowBases: array<u32>;
@group(0) @binding(8) var<storage, read_write> indirectDrawArgs: array<DrawIndirectArgs>;

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

        if (count <= MAX_TILE_ENTRIES) {
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

    // Thread 0 writes indirect dispatch args for passes 4a (small sort), 4b (bucket), 5 (rasterize).
    // Uses balanced 2D dispatch to stay within maxComputeWorkgroupsPerDimension with minimal waste:
    // y = ceil(count / maxDim), x = ceil(count / y). Waste is at most y-1 workgroups (typically 0-1).
    if (localIdx == 0u) {
        let smallCount = atomicLoad(&tileListCounts[0]);
        let largeCount = atomicLoad(&tileListCounts[1]);
        let rasterizeCount = atomicLoad(&tileListCounts[2]);
        let off = uniforms.dispatchSlotOffset;
        let maxDim = uniforms.maxWorkgroupsPerDim;

        // Slot 0: small tile sort — 1 workgroup per tile
        var sy = (smallCount + maxDim - 1u) / maxDim;
        sy = max(sy, 1u);
        indirectDispatchArgs[off + 0u] = (smallCount + sy - 1u) / sy;
        indirectDispatchArgs[off + 1u] = sy;
        indirectDispatchArgs[off + 2u] = 1u;

        // Slot 1: bucket pre-sort — 1 workgroup per large tile
        var ly = (largeCount + maxDim - 1u) / maxDim;
        ly = max(ly, 1u);
        indirectDispatchArgs[off + 3u] = (largeCount + ly - 1u) / ly;
        indirectDispatchArgs[off + 4u] = ly;
        indirectDispatchArgs[off + 5u] = 1u;

        // Slot 2: rasterize — 1 workgroup per non-empty tile
        var ry = (rasterizeCount + maxDim - 1u) / maxDim;
        ry = max(ry, 1u);
        indirectDispatchArgs[off + 6u] = (rasterizeCount + ry - 1u) / ry;
        indirectDispatchArgs[off + 7u] = ry;
        indirectDispatchArgs[off + 8u] = 1u;

        // Indirect draw args for tile-based composite: 6 vertices per tile quad
        indirectDrawArgs[uniforms.drawSlot] = DrawIndirectArgs(rasterizeCount * 6u, 1u, 0u, 0u, 0u);
    }
}
`;
