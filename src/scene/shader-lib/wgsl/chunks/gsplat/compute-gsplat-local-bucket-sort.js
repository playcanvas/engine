// Bucket pre-sort for large tiles (>4096 entries). One workgroup (256 threads) per large tile.
// Distributes entries into depth-ordered buckets using logarithmic spacing (more precision near,
// less far), then packs whole buckets into <=4096 chunks for subsequent independent bitonic sort.
// Uses a compact overflow region in the shared tileEntries buffer (assigned by classify pass)
// to avoid read/write aliasing during the scatter phase.

const NUM_BUCKETS = 128;

export const computeGsplatLocalBucketSortSource = /* wgsl */`

const NUM_BUCKETS: u32 = ${NUM_BUCKETS}u;
const MAX_CHUNK_SIZE: u32 = 4096u;
const WG_SIZE: u32 = 256u;
@group(0) @binding(0) var<storage, read_write> tileEntries: array<u32>;
@group(0) @binding(1) var<storage, read> largeTileOverflowBases: array<u32>;
@group(0) @binding(2) var<storage, read> tileSplatCounts: array<u32>;
@group(0) @binding(3) var<storage, read> depthBuffer: array<u32>;
@group(0) @binding(4) var<storage, read> largeTileList: array<u32>;
@group(0) @binding(5) var<storage, read_write> chunkRanges: array<u32>;
@group(0) @binding(6) var<storage, read_write> totalChunks: array<atomic<u32>>;

@group(0) @binding(7) var<storage, read> tileListCounts: array<u32>;

struct Uniforms {
    bufferCapacity: u32,
    maxChunks: u32,
}
@group(0) @binding(8) var<uniform> uniforms: Uniforms;

var<workgroup> sDepthMin: atomic<u32>;
var<workgroup> sDepthMax: atomic<u32>;
var<workgroup> sBucketCounts: array<atomic<u32>, NUM_BUCKETS>;
var<workgroup> sBucketOffsets: array<u32, NUM_BUCKETS + 1>;
var<workgroup> sBucketCursors: array<atomic<u32>, NUM_BUCKETS>;

@compute @workgroup_size(256)
fn main(
    @builtin(local_invocation_index) localIdx: u32,
    @builtin(workgroup_id) wid: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u
) {
    let largeTileIdx = wid.y * numWorkgroups.x + wid.x;
    if (largeTileIdx >= tileListCounts[1]) {
        return;
    }
    let tileIdx = largeTileList[largeTileIdx];
    let tStart = tileSplatCounts[tileIdx];
    let tEnd = tileSplatCounts[tileIdx + 1u];
    let count = tEnd - tStart;

    // Overflow scratch base for this tile (assigned by classify pass).
    // If it extends beyond buffer capacity, skip — tile renders unsorted.
    let overflowBase = largeTileOverflowBases[largeTileIdx];
    if (overflowBase + count > uniforms.bufferCapacity) {
        return;
    }

    // --- Phase 1: Find depth min/max ---
    if (localIdx == 0u) {
        atomicStore(&sDepthMin, 0xFFFFFFFFu);
        atomicStore(&sDepthMax, 0u);
    }
    if (localIdx < NUM_BUCKETS) {
        atomicStore(&sBucketCounts[localIdx], 0u);
        atomicStore(&sBucketCursors[localIdx], 0u);
    }

    workgroupBarrier();

    for (var i: u32 = localIdx; i < count; i += WG_SIZE) {
        let entryIdx = tileEntries[tStart + i];
        let depthU = depthBuffer[entryIdx];
        atomicMin(&sDepthMin, depthU);
        atomicMax(&sDepthMax, depthU);
    }

    workgroupBarrier();

    let depthMinU = atomicLoad(&sDepthMin);
    let depthMaxU = atomicLoad(&sDepthMax);
    let depthMin = bitcast<f32>(depthMinU);
    let depthMax = bitcast<f32>(depthMaxU);

    // Logarithmic bucketing: more precision for near depths, less for far.
    // Avoids oversized buckets when a dense surface (wall) occupies a narrow depth range.
    let logMin = log(max(depthMin, 1e-6));
    let logRange = log(max(depthMax, 1e-6)) - logMin;
    let bucketScale = select(f32(NUM_BUCKETS) / logRange, 0.0, logRange < 1e-10);

    // --- Phase 2: Histogram + save entry indices to overflow scratch ---
    // Write entryIdx to the overflow region so Phase 4 can read without aliasing
    // the main tileEntries range (which Phase 4 writes to).
    for (var i: u32 = localIdx; i < count; i += WG_SIZE) {
        let entryIdx = tileEntries[tStart + i];
        let depth = bitcast<f32>(depthBuffer[entryIdx]);
        let bucket = min(u32((log(max(depth, 1e-6)) - logMin) * bucketScale), NUM_BUCKETS - 1u);
        atomicAdd(&sBucketCounts[bucket], 1u);
        tileEntries[overflowBase + i] = entryIdx;
    }

    workgroupBarrier();

    // --- Phase 3: Prefix sum on bucket counts (thread 0, serial) ---
    if (localIdx == 0u) {
        sBucketOffsets[0] = 0u;
        for (var b: u32 = 0u; b < NUM_BUCKETS; b++) {
            sBucketOffsets[b + 1u] = sBucketOffsets[b] + atomicLoad(&sBucketCounts[b]);
        }
    }

    workgroupBarrier();

    // --- Phase 4: Scatter entries to tileEntries in bucket order ---
    // Read from overflow scratch, recompute bucket, scatter to tileEntries main range.
    for (var i: u32 = localIdx; i < count; i += WG_SIZE) {
        let entryIdx = tileEntries[overflowBase + i];
        let depth = bitcast<f32>(depthBuffer[entryIdx]);
        let bucket = min(u32((log(max(depth, 1e-6)) - logMin) * bucketScale), NUM_BUCKETS - 1u);
        let writePos = sBucketOffsets[bucket] + atomicAdd(&sBucketCursors[bucket], 1u);
        tileEntries[tStart + writePos] = entryIdx;
    }

    workgroupBarrier();

    // --- Phase 5: Thread 0 greedy-packs whole buckets into chunks ---
    // Buckets larger than MAX_CHUNK_SIZE are split into multiple pieces.
    // Chunk emission is bounds-checked against maxChunks; excess chunks are dropped
    // (those entries retain bucket-level ordering but skip the bitonic sort pass).
    if (localIdx == 0u) {
        var chunkStart: u32 = 0u;
        var currentSize: u32 = 0u;
        let maxChunks = uniforms.maxChunks;

        for (var b: u32 = 0u; b < NUM_BUCKETS; b++) {
            var bRemaining = sBucketOffsets[b + 1u] - sBucketOffsets[b];
            if (bRemaining == 0u) {
                continue;
            }

            // Split oversized buckets into MAX_CHUNK_SIZE pieces
            while (bRemaining > 0u) {
                let space = MAX_CHUNK_SIZE - currentSize;
                let take = min(bRemaining, space);
                currentSize += take;
                bRemaining -= take;

                if (currentSize == MAX_CHUNK_SIZE) {
                    let cIdx = atomicAdd(&totalChunks[0], 1u);
                    if (cIdx < maxChunks) {
                        chunkRanges[cIdx * 2u] = tStart + chunkStart;
                        chunkRanges[cIdx * 2u + 1u] = currentSize;
                    }
                    chunkStart += currentSize;
                    currentSize = 0u;
                }
            }
        }

        if (currentSize > 0u) {
            let cIdx = atomicAdd(&totalChunks[0], 1u);
            if (cIdx < maxChunks) {
                chunkRanges[cIdx * 2u] = tStart + chunkStart;
                chunkRanges[cIdx * 2u + 1u] = currentSize;
            }
        }
    }
}
`;
