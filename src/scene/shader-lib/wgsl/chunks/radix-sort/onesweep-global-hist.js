// OneSweep - GlobalHistogram kernel
//
// Single dispatch that reads each key ONCE and produces per-digit histograms
// for all radix passes simultaneously. This replaces the per-pass histogram
// dispatch of the traditional multi-pass radix sort, saving `numPasses - 1`
// full-bandwidth scans of the key buffer.
//
// Ported from `SweepCommon.hlsl::GlobalHistogram` of
// [b0nes164/GPUSorting](https://github.com/b0nes164/GPUSorting) (MIT License).
//
// Algorithm:
//  - Each workgroup of G_HIST_DIM (=128) threads owns one partition of
//    G_HIST_PART_SIZE (=32768) keys (= G_HIST_PART_SIZE/4 vec4 slots).
//  - The key buffer is bound as array<vec4<u32>>; each thread loads one vec4
//    (= 4 keys) per iteration. This lets the WGSL compiler emit a single
//    128-bit load per iteration instead of four 32-bit loads, cutting load
//    instruction count 4x. Memory traffic is unchanged; the warp still
//    coalesces into the same cache lines.
//  - Two rows of per-pass shared histograms (2 × NUM_PASSES × RADIX u32) are
//    kept in workgroup memory. The top half of the block (threads 0..63) bumps
//    row 0, the bottom half (64..127) bumps row 1, halving atomic contention.
//  - After the tile is processed, rows are reduced and added into the global
//    histogram b_globalHist[pass * RADIX + digit] atomically.
//
// The global histogram is the input to the Scan kernel, which in turn produces
// the base offsets consumed by DigitBinningPass during lookback.
//
// Alignment requirement: numKeys must be a multiple of 4 (= the key buffer
// size must be a multiple of 16 bytes). Enforced by an assert in
// ComputeOneSweepRadixSort. Callers with odd sizes should pad or fall back to
// the classic ComputeRadixSort.

export const onesweepGlobalHistSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> b_sort: array<vec4<u32>>;
@group(0) @binding(1) var<storage, read_write> b_globalHist: array<atomic<u32>>;

struct OneSweepUniforms {
    numKeys: u32,
    threadBlocks: u32,   // number of DigitBinningPass workgroups (unused here)
    numPasses: u32,      // 1..MAX_PASSES
    _pad: u32
};
@group(0) @binding(2) var<uniform> uniforms: OneSweepUniforms;

const RADIX: u32 = 256u;
const MAX_PASSES: u32 = 4u;
const G_HIST_DIM: u32 = {G_HIST_DIM}u;
const G_HIST_PART_SIZE: u32 = {G_HIST_PART_SIZE}u;
const G_HIST_PART_SIZE_VEC: u32 = G_HIST_PART_SIZE / 4u; // partition in vec4 units
const SHARED_HIST_SIZE: u32 = 2u * MAX_PASSES * RADIX; // 2048

// 2 rows × MAX_PASSES × RADIX u32 atomics. For NUM_PASSES < MAX_PASSES the
// trailing rows are unused but harmless.
var<workgroup> g_gHist: array<atomic<u32>, SHARED_HIST_SIZE>;

fn histOffset(row: u32, pass_: u32) -> u32 {
    return row * RADIX + pass_ * 2u * RADIX;
}

@compute @workgroup_size(G_HIST_DIM, 1, 1)
fn main(
    @builtin(local_invocation_index) gtid: u32,
    @builtin(workgroup_id) gid: vec3<u32>,
    @builtin(num_workgroups) nwg: vec3<u32>,
) {
    let flatGid = gid.x + gid.y * nwg.x;
    let numPasses = uniforms.numPasses;

    // Clear shared histogram (only the rows we'll actually use).
    let sharedEnd = 2u * numPasses * RADIX;
    for (var i = gtid; i < sharedEnd; i = i + G_HIST_DIM) {
        atomicStore(&g_gHist[i], 0u);
    }
    workgroupBarrier();

    // Process this workgroup's partition tile (vec4 units).
    let row = gtid / 64u; // 0 or 1
    let numKeysVec = uniforms.numKeys >> 2u;
    let partitionStartVec = flatGid * G_HIST_PART_SIZE_VEC;
    let partitionEndVec = min(partitionStartVec + G_HIST_PART_SIZE_VEC, numKeysVec);

    for (var i = partitionStartVec + gtid; i < partitionEndVec; i = i + G_HIST_DIM) {
        let q = b_sort[i];
        // Unrolled per-lane, per-pass digit extraction. MAX_PASSES is
        // compile-time, so the naga optimizer will strip the guarded branches
        // for NUM_PASSES < 4.
        if (numPasses >= 1u) {
            let off = histOffset(row, 0u);
            atomicAdd(&g_gHist[(q.x & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[(q.y & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[(q.z & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[(q.w & 0xFFu) + off], 1u);
        }
        if (numPasses >= 2u) {
            let off = histOffset(row, 1u);
            atomicAdd(&g_gHist[((q.x >> 8u) & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[((q.y >> 8u) & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[((q.z >> 8u) & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[((q.w >> 8u) & 0xFFu) + off], 1u);
        }
        if (numPasses >= 3u) {
            let off = histOffset(row, 2u);
            atomicAdd(&g_gHist[((q.x >> 16u) & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[((q.y >> 16u) & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[((q.z >> 16u) & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[((q.w >> 16u) & 0xFFu) + off], 1u);
        }
        if (numPasses >= 4u) {
            let off = histOffset(row, 3u);
            atomicAdd(&g_gHist[((q.x >> 24u) & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[((q.y >> 24u) & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[((q.z >> 24u) & 0xFFu) + off], 1u);
            atomicAdd(&g_gHist[((q.w >> 24u) & 0xFFu) + off], 1u);
        }
    }
    workgroupBarrier();

    // Reduce rows and atomically add into global histogram.
    for (var i = gtid; i < RADIX; i = i + G_HIST_DIM) {
        for (var p = 0u; p < numPasses; p = p + 1u) {
            let row0 = atomicLoad(&g_gHist[i + histOffset(0u, p)]);
            let row1 = atomicLoad(&g_gHist[i + histOffset(1u, p)]);
            let total = row0 + row1;
            if (total != 0u) {
                atomicAdd(&b_globalHist[i + p * RADIX], total);
            }
        }
    }
}
`;

export default onesweepGlobalHistSource;
