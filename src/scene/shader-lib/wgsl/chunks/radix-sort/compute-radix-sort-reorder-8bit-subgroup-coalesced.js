// 8-bit Radix Sort - Subgroup-ranked Scatter with coalesced global writes
//
// Builds on `compute-radix-sort-reorder-8bit-subgroup-ranked.js`: same
// RankKeysWGE16 register-resident ranking + circular-shift scan across warps,
// but the final scatter is staged through shared memory so global writes are
// coalesced within each warp. This is a port of the `ScatterKeysShared` +
// `WaveHistReductionExclusiveScanWGE16` + `ScatterPairsDevice` idiom from
// [b0nes164/GPUSorting](https://github.com/b0nes164/GPUSorting) (MIT License).
//
// Algorithm (per tile):
//  1. Clear per-warp histograms (MAX_SUBGROUPS × RADIX u32).
//  2. Wave-interleaved load of KEYS_PER_THREAD keys + values into registers.
//     Warp `w` owns partition positions [w*256, (w+1)*256) so iterating warps
//     in ascending order preserves the input ordering → stable sort.
//  3. Rank keys via RankKeysWGE16 (8 subgroupBallots per key, atomicAdd to a
//     private per-warp histogram row, subgroupShuffle broadcast of the
//     leader's pre-increment). Produces per-key intra-warp digit rank.
//  4. Circular-shift inclusive scan across warps → rows 1..MAX_SUBGROUPS-1
//     hold the exclusive warp prefix for each digit. Return value is
//     `histReduction` per thread: the total count of digit TID in the block.
//  5. Hierarchical exclusive scan over `histReduction` across all 256
//     threads: (a) subgroupExclusiveAdd per-warp, (b) per-warp totals scan
//     (TID==0 serially, 8 items), (c) combine. Produces `myDigitBase` per
//     thread: the block-local base for digit TID (where its run starts in
//     the packed staging area).
//  6. Stash myDigitBase in shared `digit_base[TID]`, then each thread
//     computes its keys' block-local scatter positions:
//        scatterPos[i] = offsets[i] + warpBase[digit] + digit_base[digit]
//  7. Overwrite `digit_base[TID]` with the GLOBAL base for digit TID:
//        digit_base[TID] = prefix_block_sum[TID*N + blockId] - myDigitBase
//     After this, `digit_base[digit] + linearIdx` is the global output
//     position for any key at staging position `linearIdx` with that digit.
//  8. Scatter keys into staging (reusing `g_d`) at scatterPos[i]. Dummies
//     skipped so staging [0, validInBlock) is dense.
//  9. Barrier, then each thread reads 8 staging slots linearly
//     (g_d[TID + r*256] for r=0..7), recovers each key's digit, computes
//     globalPos = digit_base[digit] + linearIdx, and writes to outputKeys.
//     Within a warp of 32 consecutive linearIdx reads, the keys belong to
//     at most 1-2 digits (digit boundaries are sparse), so global writes
//     coalesce into 1-2 128-byte transactions per warp — vs 32 scattered
//     transactions in the non-coalesced variants. The key's digit is saved
//     to linearDigits[r] for the follow-up value phase.
// 10. Same staging dance for values: scatter into g_d at scatterPos[i], read
//     back linearly, write to outputValues using the cached linearDigits[r].
//     Keys and values must go through staging separately because the 8 KB
//     staging area cannot hold both at once under the 16 KB shared-memory
//     budget (2048 keys + 2048 values = 16 KB alone, leaving no room for
//     digit_base / warp_totals).
//
// Shared memory (9 KB total, within the WebGPU 16 KB guarantee):
//   g_d:          atomic<u32>[2048]   — 8 KB, per-warp hist → key staging → value staging
//   digit_base:   u32[256]            — 1 KB, per-digit block base → global base
//   warp_totals:  u32[8]              — 32 B, scratch for the hierarchical scan
//
// Subgroup-size handling: `MAX_SUBGROUPS` is parametrized by the host from
// `device.maxSubgroupSize` (256 / sgSize). Correct on
// Apple M-series, NVIDIA, Intel, Mali, Adreno. Host falls back to the 4-bit
// path for sgSize != 32 or devices without subgroup support.
//
// Stability: preserved by (a) wave-interleaved loads putting earlier
// partition positions in earlier warps, (b) the circular-shift scan running
// warps in ascending order, (c) each thread's ranking loop iterating rounds
// in ascending order (via a single sequential atomicAdd per warp-digit
// stream), (d) stable per-digit bucket packing in the staging phase. See
// the non-coalesced variant for the full stability proof.
//
// On NVIDIA Turing (SM75+) with Independent Thread Scheduling, the
// round-to-round atomicAdd ordering and subgroupShuffle reconvergence within
// a warp are not formally guaranteed by the WGSL memory model. To prevent
// rare single-key drops that manifest as a full-array shift-by-one cascade,
// the ranking loop ends each iteration with a `workgroupBarrier()` which
// forces reconvergence (WGSL does not expose a subgroup-only barrier).

export const radixSort8bitSubgroupCoalescedReorderSource = /* wgsl */`

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
// g_d is reused between per-warp histograms (MAX_SUBGROUPS * RADIX u32) and
// per-key staging (ELEMENTS_PER_WORKGROUP u32). Pick the larger of the two
// so both phases fit. For sgSize==32 the two sizes coincide at 2048; for
// sgSize==16 the histogram phase needs 4096; for sgSize>=64 the staging
// phase dominates at 2048.
const STAGING_SIZE: u32 = max(MAX_SUBGROUPS * RADIX, ELEMENTS_PER_WORKGROUP);

// Three-phase shared-memory reuse:
//   phase A (ranking):        per-warp histograms, MAX_SUBGROUPS × RADIX u32
//   phase E (key staging):    staged keys at block-local scatter positions
//   phase G (value staging):  staged values at same scatter positions
// Declared atomic to satisfy the atomicAdd in ranking. Other phases use
// atomicStore/atomicLoad which behave like plain stores/loads on modern GPUs.
var<workgroup> g_d: array<atomic<u32>, STAGING_SIZE>;

// After phase B: per-digit block-local base (where digit TID's run starts in
// the staging area). After phase D: per-digit GLOBAL base, such that adding
// the staging linear index gives the global output position.
var<workgroup> digit_base: array<u32, RADIX>;

// Per-warp totals scratch for the hierarchical exclusive scan in phase B.
var<workgroup> warp_totals: array<u32, MAX_SUBGROUPS>;

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
    // AND-chain correct regardless of driver behaviour. 1u << 32u is UB so
    // branch on sgSize < 32.
    let activeMask = select(0xFFFFFFFFu, (1u << sgSize) - 1u, sgSize < 32u);

    // ---- Phase A.1: clear per-warp histograms ----
    for (var w = 0u; w < MAX_SUBGROUPS; w++) {
        atomicStore(&g_d[w * RADIX + TID], 0u);
    }
    workgroupBarrier();

    #ifdef USE_INDIRECT_SORT
        let elementCount = sortElementCount[0];
    #else
        let elementCount = uniforms.elementCount;
    #endif

    // Count of valid keys in this block. For the last partial block this
    // is < ELEMENTS_PER_WORKGROUP; staging slots [validInBlock, PART_SIZE)
    // are left unwritten and skipped by the linear read loop.
    let validInBlock = select(
        0u,
        min(ELEMENTS_PER_WORKGROUP, elementCount - WID),
        WID < elementCount
    );

    // ---- Phase A.2: wave-interleaved load of keys + values ----
    let subPartSize = sgSize * ELEMENTS_PER_THREAD;
    let waveBase = WID + waveIndex * subPartSize;

    var keys: array<u32, {ELEMENTS_PER_THREAD}>;
    var values: array<u32, {ELEMENTS_PER_THREAD}>;
    var validMask: u32 = 0u;
    for (var i = 0u; i < ELEMENTS_PER_THREAD; i++) {
        let gid = waveBase + sgInvId + i * sgSize;
        let is_valid = gid < elementCount;
        // Dummy 0xFFFFFFFF for invalid lanes: validBallot drops them from
        // any real digit's run, so they don't contribute to ranking.
        keys[i] = select(0xFFFFFFFFu, inputKeys[gid], is_valid);
        values[i] = select(0u, select(inputValues[gid], gid, IS_FIRST_PASS == 1u), is_valid);
        if (is_valid) {
            validMask |= (1u << i);
        }
    }

    // ---- Phase A.3: rank keys (RankKeysWGE16) ----
    var offsets: array<u32, {ELEMENTS_PER_THREAD}>;
    for (var i = 0u; i < ELEMENTS_PER_THREAD; i++) {
        let k = keys[i];
        let isValid = ((validMask >> i) & 1u) == 1u;
        let digit = (k >> CURRENT_BIT) & 0xFFu;

        var waveFlag: u32 = activeMask;
        for (var b = 0u; b < 8u; b++) {
            let t = ((digit >> b) & 1u) == 1u;
            let ballot = subgroupBallot(t).x;
            waveFlag = waveFlag & select(~ballot, ballot, t);
        }
        let validBallot = subgroupBallot(isValid).x;
        waveFlag = waveFlag & validBallot;

        let peerBits = countOneBits(waveFlag & ltMask);
        let totalBits = countOneBits(waveFlag);
        let lowestRankPeer = firstTrailingBit(waveFlag);

        var preIncrementVal: u32 = 0u;
        if (isValid && peerBits == 0u) {
            preIncrementVal = atomicAdd(&g_d[waveIndex * RADIX + digit], totalBits);
        }
        offsets[i] = subgroupShuffle(preIncrementVal, lowestRankPeer) + peerBits;

        // Force lane reconvergence before the next iteration. Without this,
        // NVIDIA Turing+ Independent Thread Scheduling can let two different
        // rounds of this loop interleave within a single warp. When two different
        // lanes happen to be leaders for the same digit in different rounds,
        // their atomicAdd/subgroupShuffle pair can see stale/out-of-order values,
        // producing duplicate or gap ranks and a single dropped key per block.
        // WGSL has no subgroupBarrier, so we use workgroupBarrier; the cost is
        // amortised across the 8-iteration ranking loop.
        workgroupBarrier();
    }

    // ---- Phase A.4: circular-shift inclusive scan across warps ----
    // Rows 1..MAX_SUBGROUPS-1 end up holding the exclusive warp prefix for
    // each digit. myHistRed is the total count of digit TID in the block,
    // needed for the per-digit exclusive scan below.
    var myHistRed: u32 = 0u;
    {
        var histReduction = atomicLoad(&g_d[TID]);
        for (var w = 1u; w < MAX_SUBGROUPS; w++) {
            let idx = TID + w * RADIX;
            let cnt = atomicLoad(&g_d[idx]);
            histReduction = histReduction + cnt;
            atomicStore(&g_d[idx], histReduction - cnt);
        }
        myHistRed = histReduction;
    }
    workgroupBarrier();

    // ---- Phase B: per-digit exclusive scan (hierarchical) ----
    // Step 1: subgroupExclusiveAdd within each warp + subgroupAdd for warp
    // total. Step 2: serial scan of the 8 warp totals (TID == 0). Step 3:
    // combine warp-local exclusive prefix with the warp base.
    let warpExcl = subgroupExclusiveAdd(myHistRed);
    let warpTotal = subgroupAdd(myHistRed);

    if (sgInvId == 0u) {
        warp_totals[waveIndex] = warpTotal;
    }
    workgroupBarrier();

    if (TID == 0u) {
        var acc: u32 = 0u;
        for (var w = 0u; w < MAX_SUBGROUPS; w++) {
            let t = warp_totals[w];
            warp_totals[w] = acc;
            acc = acc + t;
        }
    }
    workgroupBarrier();

    let myDigitBase = warpExcl + warp_totals[waveIndex];

    // Publish myDigitBase so every thread can look up bases for its keys'
    // digits (which differ from TID for most keys).
    digit_base[TID] = myDigitBase;
    workgroupBarrier();

    // ---- Phase C: per-key scatter positions (block-local) ----
    // scatterPos[i] is a unique value in [0, validInBlock) for valid keys,
    // partitioned into contiguous per-digit runs.
    var scatterPos: array<u32, {ELEMENTS_PER_THREAD}>;
    for (var i = 0u; i < ELEMENTS_PER_THREAD; i++) {
        let k = keys[i];
        let digit = (k >> CURRENT_BIT) & 0xFFu;
        let warpBase = select(0u, atomicLoad(&g_d[waveIndex * RADIX + digit]), waveIndex > 0u);
        scatterPos[i] = offsets[i] + warpBase + digit_base[digit];
    }
    workgroupBarrier();

    // ---- Phase D + E (interleaved) ----
    // D: convert digit_base to the per-digit GLOBAL base so the linear
    //    read phase can compute output positions with a single add.
    // E: scatter keys into the shared-memory staging area (overwriting
    //    g_d, whose per-warp prefixes we no longer need).
    // D touches digit_base only; E touches g_d only; they are independent
    // and share a single barrier after both.
    let globalPrefix = prefix_block_sum[TID * uniforms.workgroupCount + WORKGROUP_ID];
    digit_base[TID] = globalPrefix - myDigitBase;

    for (var i = 0u; i < ELEMENTS_PER_THREAD; i++) {
        if (((validMask >> i) & 1u) == 1u) {
            atomicStore(&g_d[scatterPos[i]], keys[i]);
        }
    }
    workgroupBarrier();

    // ---- Phase F: linear key read → coalesced global write ----
    // Each thread reads 8 staging slots strided by THREADS_PER_WORKGROUP.
    // Within a warp, 32 consecutive linearIdx values → 32 consecutive keys
    // in the packed staging area → at most 2 distinct digits → 1-2 128-byte
    // global write transactions (vs 32 scattered writes in the non-coalesced
    // variants). Digits are cached for the value phase below.
    var linearDigits: array<u32, {ELEMENTS_PER_THREAD}>;
    for (var r = 0u; r < ELEMENTS_PER_THREAD; r++) {
        let linearIdx = TID + r * THREADS_PER_WORKGROUP;
        if (linearIdx < validInBlock) {
            let k = atomicLoad(&g_d[linearIdx]);
            let digit = (k >> CURRENT_BIT) & 0xFFu;
            linearDigits[r] = digit;
            let globalPos = digit_base[digit] + linearIdx;
            if (IS_LAST_PASS == 0u) {
                outputKeys[globalPos] = k;
            }
        }
    }
    workgroupBarrier();

    // ---- Phase G: scatter values into staging ----
    // Same scatterPos[i] as the key phase; keys have already been written
    // to global so overwriting the staging is safe.
    for (var i = 0u; i < ELEMENTS_PER_THREAD; i++) {
        if (((validMask >> i) & 1u) == 1u) {
            atomicStore(&g_d[scatterPos[i]], values[i]);
        }
    }
    workgroupBarrier();

    // ---- Phase H: linear value read → coalesced global write ----
    // linearDigits[r] was cached in phase F so we don't need to re-read
    // the keys (they're no longer in staging).
    for (var r = 0u; r < ELEMENTS_PER_THREAD; r++) {
        let linearIdx = TID + r * THREADS_PER_WORKGROUP;
        if (linearIdx < validInBlock) {
            let v = atomicLoad(&g_d[linearIdx]);
            let digit = linearDigits[r];
            let globalPos = digit_base[digit] + linearIdx;
            outputValues[globalPos] = v;
        }
    }
}
`;

export default radixSort8bitSubgroupCoalescedReorderSource;
