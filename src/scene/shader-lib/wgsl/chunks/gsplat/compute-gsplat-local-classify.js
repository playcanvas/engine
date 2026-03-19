// Tile classification: scans prefix-summed tile counts, builds small/large/rasterize
// tile lists, and writes indirect dispatch args for subsequent passes.
// For large tiles (>4096 entries), assigns compact overflow scratch offsets within
// the shared tileEntries buffer (overflow region starts at totalEntries).
// Single workgroup (256 threads) — each thread processes ceil(numTiles/256) tiles.
export const computeGsplatLocalClassifySource = /* wgsl */`

const MAX_TILE_ENTRIES: u32 = 4096u;
const CLASSIFY_WORKGROUP: u32 = 256u;

@group(0) @binding(0) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(1) var<storage, read_write> smallTileList: array<u32>;
@group(0) @binding(2) var<storage, read_write> largeTileList: array<u32>;
@group(0) @binding(3) var<storage, read_write> rasterizeTileList: array<u32>;
@group(0) @binding(4) var<storage, read_write> tileListCounts: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> indirectDispatchArgs: array<u32>;
@group(0) @binding(6) var<storage, read_write> largeTileOverflowBases: array<u32>;

struct Uniforms {
    numTiles: u32,
    dispatchSlotOffset: u32,
    bufferCapacity: u32,
    maxWorkgroupsPerDim: u32,
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
    // Uses 2D dispatch (x,y) to stay within maxComputeWorkgroupsPerDimension at high resolutions.
    if (localIdx == 0u) {
        let smallCount = atomicLoad(&tileListCounts[0]);
        let largeCount = atomicLoad(&tileListCounts[1]);
        let rasterizeCount = atomicLoad(&tileListCounts[2]);
        let off = uniforms.dispatchSlotOffset;
        let maxDim = uniforms.maxWorkgroupsPerDim;

        // Slot 0: small tile sort — 1 workgroup per tile
        indirectDispatchArgs[off + 0u] = min(smallCount, maxDim);
        indirectDispatchArgs[off + 1u] = (smallCount + maxDim - 1u) / maxDim;
        indirectDispatchArgs[off + 2u] = 1u;

        // Slot 1: bucket pre-sort — 1 workgroup per large tile
        indirectDispatchArgs[off + 3u] = min(largeCount, maxDim);
        indirectDispatchArgs[off + 4u] = (largeCount + maxDim - 1u) / maxDim;
        indirectDispatchArgs[off + 5u] = 1u;

        // Slot 2: rasterize — 1 workgroup per non-empty tile
        indirectDispatchArgs[off + 6u] = min(rasterizeCount, maxDim);
        indirectDispatchArgs[off + 7u] = (rasterizeCount + maxDim - 1u) / maxDim;
        indirectDispatchArgs[off + 8u] = 1u;
    }
}
`;
