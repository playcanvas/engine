// 8-bit Radix Sort - Subgroup-ranked Scatter pass (ported from GPUSorting)
//
// Port of the core DeviceRadixSort / OneSweep ranking logic from
// [b0nes164/GPUSorting](https://github.com/b0nes164/GPUSorting) (MIT License),
// specifically `RankKeysWGE16` + `WaveHistInclusiveScanCircularShiftWGE16`
// from `SortCommon.hlsl`, adapted to WGSL and wired into our existing
// histogram + CSDLDF scan + reorder pipeline so only the reorder kernel
// changes. The outer structure (per-block digit histograms from
// `compute-radix-sort-histogram-8bit.js`, exclusive scan over block sums,
// global scatter via `prefix_block_sum[digit*numBlocks + blockId]`) is
// unchanged from the other 8-bit reorder variants.
//
// Algorithm (per tile, all KEYS_PER_THREAD keys ranked in one pass):
//  1. Wave-interleaved load of KEYS_PER_THREAD keys + values per thread into
//     registers. Warp `w` owns partition positions [w*256 .. (w+1)*256), so
//     walking warps in ascending order preserves the input ordering and the
//     final scatter is stable.
//  2. Rank each of the KEYS_PER_THREAD keys via `RankKeysWGE16`:
//       a. 8 subgroupBallots, intersected per the `t ? ballot : ~ballot` trick,
//          produce `waveFlag` = set of subgroup lanes sharing my full 8-bit
//          digit (masked by `subgroupBallot(is_valid)` so invalid lanes never
//          join a real digit's run).
//       b. `peerBits` = popcount(waveFlag & lanes_below_me) is my intra-warp
//          rank within my digit group for this round.
//       c. The lowest-rank valid peer (leader) atomicAdds `totalBits` into
//          `g_d[digit + warp*RADIX]`. Non-leaders skip the atomicAdd.
//       d. `subgroupShuffle(preIncrementVal, lowestRankPeer)` broadcasts the
//          leader's pre-increment value to every same-digit peer; adding
//          `peerBits` gives a stable intra-warp rank across all rounds.
//  3. `WaveHistInclusiveScanCircularShiftWGE16` over the per-warp histograms:
//     for each digit column, inclusive scan across warps while writing back
//     the exclusive prefix. After this, `g_d[w*RADIX + digit]` (for w > 0)
//     contains the count of `digit` in warps [0..w-1].
//  4. Final offset = intra-warp rank (from step 2) + exclusive warp prefix
//     (from step 3, 0 for warp 0). Scatter at
//     `prefix_block_sum[digit*numBlocks + blockId] + finalOffset`.
//
// vs the per-bit ballot match-any reorder shaders in this directory, this
// variant replaces the per-round shared-memory atomicOr/atomicLoad chain
// and the O(sgId) inter-warp sum loop with:
//  - a single atomicAdd per (warp, digit, round) on a private per-warp row
//    (no cross-warp contention),
//  - one `subgroupShuffle` to broadcast the leader's pre-increment,
//  - one circular-shift scan over per-warp histograms (done once at end of
//    ranking, cost amortised over all KEYS_PER_THREAD keys).
// The reference implementation reports ~1-2 subgroup ops per key for the
// ranking step, vs 8 ballots + popcount + ~8 loads in our prior subgroup
// variants.
//
// Shared memory: MAX_SUBGROUPS * RADIX u32s = 8 * 256 * 4 B = 8 KB (same as
// the shared-mem and subgroup variants).
//
// Subgroup-size handling: `MAX_SUBGROUPS` is parametrized by the host from
// `device.maxSubgroupSize` (256 / sgSize). Valid for any subgroup size that
// divides 256 evenly (all common values: 4, 8, 16, 32, 64, 128). Shared
// memory usage scales as MAX_SUBGROUPS * RADIX u32.
//
// Scatter coalescing: this shader still scatters directly to global at
// `prefix_block_sum[...] + rank`, i.e. non-coalesced writes within a warp
// (each lane writes to a different digit bucket). Adding the reference's
// shared-memory staging + per-digit exclusive scan (`WaveHistReductionExclusive
// ScanWGE16` + `ScatterKeysShared`) is the next optimisation planned on top
// of this shader.

export const radixSort8bitSubgroupRankedReorderSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> inputKeys: array<u32>;
@group(0) @binding(1) var<storage, read_write> outputKeys: array<u32>;
@group(0) @binding(2) var<storage, read> prefix_block_sum: array<u32>;
@group(0) @binding(3) var<storage, read> inputValues: array<u32>;
@group(0) @binding(4) var<storage, read_write> outputValues: array<u32>;

struct RadixSortUniforms {
    workgroupCount: u32,
    elementCount: u32
};
@group(0) @binding(5) var<uniform> uniforms: RadixSortUniforms;

#ifdef USE_INDIRECT_SORT
    @group(0) @binding(6) var<storage, read> sortElementCount: array<u32>;
#endif

const THREADS_PER_WORKGROUP: u32 = {THREADS_PER_WORKGROUP}u;
const WORKGROUP_SIZE_X: u32 = {WORKGROUP_SIZE_X}u;
const WORKGROUP_SIZE_Y: u32 = {WORKGROUP_SIZE_Y}u;
const CURRENT_BIT: u32 = {CURRENT_BIT}u;
const IS_FIRST_PASS: u32 = {IS_FIRST_PASS}u;
const IS_LAST_PASS: u32 = {IS_LAST_PASS}u;
const ELEMENTS_PER_THREAD: u32 = {ELEMENTS_PER_THREAD}u;
const ELEMENTS_PER_WORKGROUP: u32 = THREADS_PER_WORKGROUP * ELEMENTS_PER_THREAD;

const RADIX: u32 = 256u;

// Parametrized by the host from device.maxSubgroupSize (256 / sgSize).
const MAX_SUBGROUPS: u32 = {MAX_SUBGROUPS}u;
const WAVE_HISTS_SIZE: u32 = MAX_SUBGROUPS * RADIX;

// Per-warp digit histograms. During ranking, each warp accumulates its own
// row (g_d[warp*RADIX .. warp*RADIX+256)) via atomicAdds, so there is no
// cross-warp contention on writes. After ranking, a circular-shift inclusive
// scan rewrites rows 1..MAX_SUBGROUPS-1 to hold exclusive prefixes over the
// earlier warps, which are the per-warp digit bases used to convert intra-warp
// ranks to block-local ranks. Declared atomic so ranking can use atomicAdd;
// the circular-shift scan reads/writes via atomicLoad/atomicStore.
var<workgroup> g_d: array<atomic<u32>, WAVE_HISTS_SIZE>;

@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn main(
    @builtin(workgroup_id) w_id: vec3<u32>,
    @builtin(num_workgroups) w_dim: vec3<u32>,
    @builtin(local_invocation_index) TID: u32,
    @builtin(subgroup_invocation_id) sgInvId: u32,
    @builtin(subgroup_size) sgSize: u32,
) {
    let WORKGROUP_ID = w_id.x + w_id.y * w_dim.x;
    let WID = WORKGROUP_ID * ELEMENTS_PER_WORKGROUP;
    let waveIndex = TID / sgSize;
    let ltMask = (1u << sgInvId) - 1u;
    // Active-lane mask for the match-any ballot below. WGSL says inactive-lane
    // bits of subgroupBallot are 0, but drivers (notably Mali / Imagination
    // at sgSize<32) don't always honour this for subgroupBallot(is_valid).
    // Initialising waveFlag to only cover active lanes makes the per-bit
    // AND-chain correct regardless of driver behaviour. \`1u << 32u\` is UB so
    // branch on sgSize < 32.
    let activeMask = select(0xFFFFFFFFu, (1u << sgSize) - 1u, sgSize < 32u);

    // Clear per-warp histograms. THREADS_PER_WORKGROUP == RADIX and we have
    // MAX_SUBGROUPS rows, so each thread clears MAX_SUBGROUPS words.
    for (var w = 0u; w < MAX_SUBGROUPS; w++) {
        atomicStore(&g_d[w * RADIX + TID], 0u);
    }
    workgroupBarrier();

    #ifdef USE_INDIRECT_SORT
        let elementCount = sortElementCount[0];
    #else
        let elementCount = uniforms.elementCount;
    #endif

    // Wave-interleaved loads: warp \`waveIndex\` owns partition positions
    // [waveIndex*sgSize*KPT .. (waveIndex+1)*sgSize*KPT). Round \`i\` of the
    // ranking loop targets positions [... + i*sgSize, ... + (i+1)*sgSize), so
    // within a warp each round covers a contiguous sgSize-wide chunk and
    // across warps the partition is covered in ascending order → stable.
    let subPartSize = sgSize * ELEMENTS_PER_THREAD;
    let waveBase = WID + waveIndex * subPartSize;

    // Load all keys and values into registers up-front so the 8 ranking
    // rounds all operate on register-resident state with no additional
    // global loads.
    var keys: array<u32, {ELEMENTS_PER_THREAD}>;
    var values: array<u32, {ELEMENTS_PER_THREAD}>;
    var validMask: u32 = 0u; // bit i set ⇒ keys[i] is valid (ranking mask)
    for (var i = 0u; i < ELEMENTS_PER_THREAD; i++) {
        let gid = waveBase + sgInvId + i * sgSize;
        let is_valid = gid < elementCount;
        // Dummy key (0xFFFFFFFF → digit 0xFF) for invalid lanes: the validity
        // ballot still removes them from the real digit-0xFF run so they do
        // not affect the rank / atomicAdd for valid lanes.
        keys[i] = select(0xFFFFFFFFu, inputKeys[gid], is_valid);
        values[i] = select(0u, select(inputValues[gid], gid, IS_FIRST_PASS == 1u), is_valid);
        if (is_valid) {
            validMask |= (1u << i);
        }
    }

    // ---- Rank keys (port of RankKeysWGE16) ----
    // offsets[i] = intra-warp rank within this key's digit, summed across all
    // earlier rounds of this warp (via the running atomicAdd in g_d).
    var offsets: array<u32, {ELEMENTS_PER_THREAD}>;
    for (var i = 0u; i < ELEMENTS_PER_THREAD; i++) {
        let k = keys[i];
        let isValid = ((validMask >> i) & 1u) == 1u;
        let digit = (k >> CURRENT_BIT) & 0xFFu;

        // WarpLevelMultiSplitWGE16: intersect 8 ballots to isolate the set of
        // subgroup lanes whose 8-bit digit equals mine.
        var waveFlag: u32 = activeMask;
        for (var b = 0u; b < 8u; b++) {
            let t = ((digit >> b) & 1u) == 1u;
            let ballot = subgroupBallot(t).x;
            waveFlag = waveFlag & select(~ballot, ballot, t);
        }
        // Drop invalid lanes (dummy key 0xFFFFFFFF would otherwise attach to
        // the real digit-0xFF run).
        let validBallot = subgroupBallot(isValid).x;
        waveFlag = waveFlag & validBallot;

        let peerBits = countOneBits(waveFlag & ltMask);
        let totalBits = countOneBits(waveFlag);
        // firstTrailingBit(0) is undefined on some targets, but waveFlag
        // always has at least my own bit set when \`isValid\`, and we only use
        // the broadcast result for valid lanes (scatter is gated on isValid).
        let lowestRankPeer = firstTrailingBit(waveFlag);

        // Only the leader (lowest-rank valid peer) publishes this round's
        // totalBits into the shared per-warp histogram. Non-leaders keep
        // \`preIncrementVal\` at 0; they don't read their own value, they read
        // the leader's via subgroupShuffle below.
        var preIncrementVal: u32 = 0u;
        if (isValid && peerBits == 0u) {
            preIncrementVal = atomicAdd(&g_d[waveIndex * RADIX + digit], totalBits);
        }
        offsets[i] = subgroupShuffle(preIncrementVal, lowestRankPeer) + peerBits;

        // Force lane reconvergence before the next iteration. Without this,
        // NVIDIA Turing+ Independent Thread Scheduling can let two different
        // rounds of this loop interleave within a single warp, which can cause
        // round-to-round atomicAdd/subgroupShuffle pairs to see stale/out-of-
        // order values and produce a duplicate or gap rank for a single digit.
        // WGSL has no subgroupBarrier, so we use workgroupBarrier; the cost is
        // amortised across the 8-iteration ranking loop.
        workgroupBarrier();
    }

    // ---- WaveHistInclusiveScanCircularShiftWGE16 ----
    // For each digit column \`TID\`, inclusive-scan the per-warp counts across
    // warps and write back the EXCLUSIVE prefix in-place. Rows 1..MAX-1 end up
    // holding \`sum(cnt[0..w-1][digit])\`, which is the per-warp base for this
    // digit. Row 0 still holds warp 0's own count and is not used below.
    {
        var histReduction = atomicLoad(&g_d[TID]);
        for (var w = 1u; w < MAX_SUBGROUPS; w++) {
            let idx = TID + w * RADIX;
            let cnt = atomicLoad(&g_d[idx]);
            histReduction = histReduction + cnt;
            atomicStore(&g_d[idx], histReduction - cnt);
        }
    }
    workgroupBarrier();

    // ---- Scatter ----
    // Final block-local rank = intra-warp rank + exclusive warp prefix for
    // this key's digit. Warp 0 uses 0 for the prefix (row 0 holds its own
    // count, not an exclusive prefix).
    for (var i = 0u; i < ELEMENTS_PER_THREAD; i++) {
        let isValid = ((validMask >> i) & 1u) == 1u;
        if (isValid) {
            let k = keys[i];
            let digit = (k >> CURRENT_BIT) & 0xFFu;
            let warpBase = select(0u, atomicLoad(&g_d[waveIndex * RADIX + digit]), waveIndex > 0u);
            let rankInBlock = offsets[i] + warpBase;

            let pid = digit * uniforms.workgroupCount + WORKGROUP_ID;
            let sorted_position = prefix_block_sum[pid] + rankInBlock;

            if (IS_LAST_PASS == 0u) {
                outputKeys[sorted_position] = k;
            }
            outputValues[sorted_position] = values[i];
        }
    }
}
`;

export default radixSort8bitSubgroupRankedReorderSource;
