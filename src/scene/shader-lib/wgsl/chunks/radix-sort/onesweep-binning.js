// OneSweep - DigitBinningPass kernel
//
// Fused rank + scan + scatter kernel. For each radix pass, this kernel
// replaces the separate histogram / scan / reorder dispatches of a classic
// multi-pass radix sort with a single dispatch that:
//
//   1. Atomically grabs a partition tile id from `b_index[pass]`.
//   2. Clears its per-warp digit histograms in shared memory.
//   3. Wave-interleaved load of KEYS_PER_THREAD keys + values per thread
//      (stability: earlier partition positions end up in earlier warps).
//      Values ride alongside keys in registers so phase G avoids a second
//      full-bandwidth read of the value buffer.
//   4. RankKeysWGE16: 8 subgroup-ballot intersections per key to derive the
//      lane-local rank; leader lane atomically bumps its warp's histogram
//      row, result is broadcast via subgroupShuffle.
//   5. Circular-shift inclusive scan across warp rows → per-warp exclusive
//      prefixes for each digit.
//   6. DeviceBroadcastReductions: publish this block's per-digit totals into
//      `b_passHist[(pass*tb + partIndex+1)*RADIX + digit]` as FLAG_REDUCTION.
//   7. Hierarchical exclusive scan over the 256 per-digit totals → per-digit
//      block-local base (myDigitBase).
//   8. Scatter keys into shared-memory staging at block-local sorted offset.
//   9. Lookback: each digit-owning thread walks previous partitions via
//      atomicLoad on passHist. When it finds FLAG_INCLUSIVE, it accumulates
//      the full exclusive prefix; otherwise it accumulates FLAG_REDUCTION
//      values and keeps walking. On finding the inclusive, it also atomically
//      upgrades its own published reduction to FLAG_INCLUSIVE (by adding
//      `1 | lookbackReduction << 2`, flipping FLAG_REDUCTION→FLAG_INCLUSIVE
//      while folding in the prefix) so subsequent blocks can terminate
//      earlier.
//  10. digit_base[gtid] = globalPrefix - myDigitBase. Adding a linear index
//      `i` in [0, PART_SIZE) then gives the global output position for any
//      key in staging slot `i` (whose digit was recorded separately).
//  11. Linear coalesced scatter of keys: each thread reads 15 staging slots
//      strided by D_DIM. Within a warp of 32 consecutive linear indices, the
//      keys belong to at most a couple of digits, so the global writes
//      coalesce into 1-2 128-byte transactions per warp.
//  12. Value phase: scatter pre-loaded register values through staging using
//      the same offsets, coalesced write using the cached per-slot digit
//      from 11.
//
// Ported from `OneSweep.hlsl::DigitBinningPass` +
// `SweepCommon.hlsl::{AssignPartitionTile,DeviceBroadcastReductions,Lookback}`
// + `SortCommon.hlsl::{RankKeysWGE16,WaveHistInclusiveScanCircularShiftWGE16,
// UpdateOffsetsWGE16,ScatterKeysShared,ScatterDevice*}` of
// [b0nes164/GPUSorting](https://github.com/b0nes164/GPUSorting) (MIT License).
//
// Portability: the plain Lookback used here spins on previous partitions.
// This requires forward-thread-progress guarantees and works reliably on
// NVIDIA, AMD and Intel. On devices lacking those guarantees (Apple Silicon,
// Mali, Adreno) use {@link ComputeRadixSort} instead.

export const onesweepBinningSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> inputKeys: array<u32>;
@group(0) @binding(1) var<storage, read_write> outputKeys: array<u32>;
@group(0) @binding(2) var<storage, read> inputValues: array<u32>;
@group(0) @binding(3) var<storage, read_write> outputValues: array<u32>;
@group(0) @binding(4) var<storage, read_write> b_passHist: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> b_index: array<atomic<u32>>;

struct OneSweepBinningUniforms {
    numKeys: u32,
    threadBlocks: u32,   // DigitBinningPass workgroup count per pass
    pass_: u32,          // 0..NUM_PASSES-1
    flags: u32           // bit 0: isFirstPass, bit 1: isLastPass (skip key write)
};
@group(0) @binding(6) var<uniform> uniforms: OneSweepBinningUniforms;

const RADIX: u32 = 256u;
const RADIX_MASK: u32 = 255u;
const RADIX_LOG: u32 = 8u;

const D_DIM: u32 = {D_DIM}u;
const KEYS_PER_THREAD: u32 = {KEYS_PER_THREAD}u;
const PART_SIZE: u32 = D_DIM * KEYS_PER_THREAD; // 3840 for D_DIM=256, KEYS=15
// Parametrized by the host from device.maxSubgroupSize:
//  sgSize=32 (NVIDIA / Apple M-series / Intel / desktop AMD): MAX_SUBGROUPS = 8,  WAVE_HISTS_SIZE = 2048.
//  sgSize=16 (Mali / Pixel / some Imagination):                MAX_SUBGROUPS = 16, WAVE_HISTS_SIZE = 4096.
//  sgSize=64/128 (Adreno):                                     MAX_SUBGROUPS = 4,  WAVE_HISTS_SIZE = 1024.
const MAX_SUBGROUPS: u32 = {MAX_SUBGROUPS}u;
const WAVE_HISTS_SIZE: u32 = MAX_SUBGROUPS * RADIX;

// g_d must be large enough for both the ranking phase (WAVE_HISTS_SIZE slots)
// and the staging phase (PART_SIZE slots). For D_DIM=256, KEYS_PER_THREAD=15
// this is:
//  sgSize=32 (MAX_SUBGROUPS=8 ): max(3840, 2048) = 3840
//  sgSize=16 (MAX_SUBGROUPS=16): max(3840, 4096) = 4096  (+1 KiB vs sgSize=32)
//  sgSize=64 (MAX_SUBGROUPS=4 ): max(3840, 1024) = 3840
// Sizing g_d to PART_SIZE alone (as in the original port) corrupts waves 15..
// on sgSize=16 hardware because their per-warp histogram slots fall out of
// bounds.
const G_D_SIZE: u32 = max(PART_SIZE, WAVE_HISTS_SIZE);

const FLAG_NOT_READY: u32 = 0u;
const FLAG_REDUCTION: u32 = 1u;
const FLAG_INCLUSIVE: u32 = 2u;
const FLAG_MASK: u32 = 3u;

// Staging memory. Reused across phases:
//   phase A (ranking):          per-warp histograms (MAX_SUBGROUPS × 256 u32) in slots 0..WAVE_HISTS_SIZE
//   phase E (key staging):      sorted keys at block-local offset, slots 0..PART_SIZE
//   phase G (value staging):    values at block-local offset, slots 0..PART_SIZE
// Declared atomic to satisfy atomicAdd in phase A. Other phases use
// atomicStore/atomicLoad which behave like plain stores/loads on modern GPUs.
var<workgroup> g_d: array<atomic<u32>, G_D_SIZE>;

// After phase B: per-digit block-local base.
// After phase D: per-digit GLOBAL base (minus block-local exclusive prefix).
// Adding a linear staging index to digit_base[digit] gives the global output
// position for any key at that staging slot with that digit.
var<workgroup> digit_base: array<u32, RADIX>;

// Scratch for the 2-level exclusive scan of per-digit block totals.
var<workgroup> sg_totals: array<u32, MAX_SUBGROUPS>;

// Broadcast slot for the atomically-acquired partition tile id.
var<workgroup> wg_partIndex: u32;

fn passHistOffset(pass_: u32, partitionIdx: u32) -> u32 {
    return pass_ * uniforms.threadBlocks * RADIX + partitionIdx * RADIX;
}

@compute @workgroup_size(D_DIM, 1, 1)
fn main(
    @builtin(local_invocation_index) TID: u32,
    @builtin(subgroup_invocation_id) sgInvId: u32,
    @builtin(subgroup_size) sgSize: u32,
) {
    let waveIndex = TID / sgSize;
    let ltMask = (1u << sgInvId) - 1u;
    // Active-lane mask for the match-any ballot below. WGSL says inactive-lane
    // bits of subgroupBallot are 0, but drivers (notably Mali / Imagination
    // at sgSize<32) don't always honour this for subgroupBallot(is_valid).
    // Initialising waveFlag to only cover active lanes makes the per-bit
    // AND-chain correct regardless of driver behaviour. 1u << 32u is UB so
    // branch on sgSize < 32.
    let activeMask = select(0xFFFFFFFFu, (1u << sgSize) - 1u, sgSize < 32u);
    let pass_ = uniforms.pass_;
    let currentBit = pass_ << 3u;
    let threadBlocks = uniforms.threadBlocks;
    let isFirstPass = (uniforms.flags & 1u) != 0u;
    let isLastPass = (uniforms.flags & 2u) != 0u;

    // ---- Phase 0: assign partition tile ----
    if (TID == 0u) {
        wg_partIndex = atomicAdd(&b_index[pass_], 1u);
    }
    let partitionIndex = workgroupUniformLoad(&wg_partIndex);

    // ---- Phase A.1: clear per-warp histograms ----
    // Only the first 2048 slots hold wave hists during ranking. We clear and
    // re-use them; later phases (staging) overwrite beyond slot 2048 too.
    for (var i = TID; i < WAVE_HISTS_SIZE; i = i + D_DIM) {
        atomicStore(&g_d[i], 0u);
    }
    workgroupBarrier();

    let tileStart = partitionIndex * PART_SIZE;
    let validInBlock = select(
        0u,
        min(PART_SIZE, uniforms.numKeys - tileStart),
        tileStart < uniforms.numKeys
    );

    // ---- Phase A.2: wave-interleaved load of keys + values ----
    // Values are loaded up-front (into registers) alongside keys so that phase G
    // does not need a second full-bandwidth read of inputValues. This saves one
    // pass over the value buffer per radix pass, at the cost of keeping
    // KEYS_PER_THREAD extra u32 live across the ranking loop. With
    // KEYS_PER_THREAD a compile-time constant and static indexing preserved,
    // the compiler register-allocates values[] the same way it does keys[].
    let subPartSize = sgSize * KEYS_PER_THREAD;
    let waveBase = tileStart + waveIndex * subPartSize;

    var keys: array<u32, {KEYS_PER_THREAD}>;
    var values: array<u32, {KEYS_PER_THREAD}>;
    var validMask: u32 = 0u;
    for (var i = 0u; i < KEYS_PER_THREAD; i = i + 1u) {
        let gid = waveBase + sgInvId + i * sgSize;
        let is_valid = gid < uniforms.numKeys;
        // Dummy 0xFFFFFFFF for invalid lanes: validBallot drops them from
        // any real digit's run.
        keys[i] = select(0xFFFFFFFFu, inputKeys[gid], is_valid);
        // On the first pass, values are synthesised as the original index
        // (identity permutation), so we skip the value-buffer load entirely.
        // On subsequent passes, values are the permutation from the previous
        // pass; read once here and reuse in phase G.
        values[i] = select(
            select(0u, inputValues[gid], is_valid),
            gid,
            isFirstPass
        );
        if (is_valid) {
            validMask = validMask | (1u << i);
        }
    }

    // ---- Phase A.3: rank keys (RankKeysWGE16) ----
    var offsets: array<u32, {KEYS_PER_THREAD}>;
    for (var i = 0u; i < KEYS_PER_THREAD; i = i + 1u) {
        let k = keys[i];
        let isValid = ((validMask >> i) & 1u) == 1u;
        let digit = (k >> currentBit) & RADIX_MASK;

        var waveFlag: u32 = activeMask;
        for (var b = 0u; b < 8u; b = b + 1u) {
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
        // rounds of this loop interleave within a single warp, corrupting the
        // atomicAdd/subgroupShuffle pairing. WGSL has no subgroupBarrier;
        // workgroupBarrier is the cheapest portable substitute.
        workgroupBarrier();
    }

    // ---- Phase A.4: circular-shift inclusive scan across warps ----
    // After this loop, for digit TID (TID < RADIX):
    //   - myHistRed = total count of digit TID across all warps in this block.
    //   - g_d[TID + w*RADIX] for w >= 1 holds the exclusive per-warp prefix.
    var myHistRed: u32 = 0u;
    {
        var histReduction = atomicLoad(&g_d[TID]);
        for (var w = 1u; w < MAX_SUBGROUPS; w = w + 1u) {
            let idx = TID + w * RADIX;
            let cnt = atomicLoad(&g_d[idx]);
            histReduction = histReduction + cnt;
            atomicStore(&g_d[idx], histReduction - cnt);
        }
        myHistRed = histReduction;
    }

    // ---- Phase A.5: publish this block's per-digit totals ----
    // DeviceBroadcastReductionsWGE16: the block at partitionIndex writes to
    // slot partitionIndex+1 of passHist (i.e. its successor's inbox). The
    // last block has no successor and skips this step.
    if (partitionIndex + 1u < threadBlocks) {
        let dst = passHistOffset(pass_, partitionIndex + 1u) + TID;
        atomicAdd(&b_passHist[dst], FLAG_REDUCTION | (myHistRed << 2u));
    }

    // ---- Phase B: per-digit exclusive scan (hierarchical) ----
    let warpExcl = subgroupExclusiveAdd(myHistRed);
    let warpTotal = subgroupAdd(myHistRed);

    if (sgInvId == 0u) {
        sg_totals[waveIndex] = warpTotal;
    }
    workgroupBarrier();

    if (TID == 0u) {
        var acc: u32 = 0u;
        for (var w = 0u; w < MAX_SUBGROUPS; w = w + 1u) {
            let t = sg_totals[w];
            sg_totals[w] = acc;
            acc = acc + t;
        }
    }
    workgroupBarrier();

    let myDigitBase = warpExcl + sg_totals[waveIndex];

    // ---- Phase C: per-key scatter positions (block-local) ----
    // scatterPos[i] = intra-warp rank + per-warp base for this digit
    //               + block-local base across earlier digits.
    var scatterPos: array<u32, {KEYS_PER_THREAD}>;
    for (var i = 0u; i < KEYS_PER_THREAD; i = i + 1u) {
        let k = keys[i];
        let digit = (k >> currentBit) & RADIX_MASK;
        // digit_base not yet populated; we need warp base + myDigitBase for
        // the key's digit (which is DIFFERENT from TID's digit). We read
        // myDigitBase for any digit by publishing digit_base[TID] = myDigitBase
        // below, which means we need a staging step. Alternatively, compute
        // the combined base on-the-fly using the per-warp prefix stored in
        // g_d and reading myDigitBase-equivalent via a shared array.
        // We stage myDigitBase into digit_base first.
        let warpBase = select(0u, atomicLoad(&g_d[waveIndex * RADIX + digit]), waveIndex > 0u);
        scatterPos[i] = offsets[i] + warpBase; // add per-digit block base below
    }

    // Publish myDigitBase so each thread can look up the base for its keys'
    // digits (which usually differ from TID for most keys).
    digit_base[TID] = myDigitBase;
    workgroupBarrier();

    for (var i = 0u; i < KEYS_PER_THREAD; i = i + 1u) {
        let k = keys[i];
        let digit = (k >> currentBit) & RADIX_MASK;
        scatterPos[i] = scatterPos[i] + digit_base[digit];
    }
    workgroupBarrier();

    // ---- Phase D: Lookback + global base resolution ----
    // Plain decoupled lookback: each digit-owning thread walks backward
    // through passHist for its digit until it finds FLAG_INCLUSIVE,
    // accumulating reductions on the way. Requires forward-thread-progress
    // guarantees (NVIDIA Turing+, recent AMD, Intel Gen9+). On devices
    // without those guarantees (Apple Silicon, Mali, Adreno) this may
    // deadlock; callers should use {@link ComputeRadixSort} on those
    // architectures instead.
    // On finding FLAG_INCLUSIVE, it atomically upgrades its own (partition+1)
    // slot to FLAG_INCLUSIVE so later blocks terminate faster.
    // No workgroupBarrier inside the loop: the spin is per-thread/digit and
    // we only need sync *after* all threads complete, before scatter uses
    // digit_base in its new form.
    if (TID < RADIX) {
        var lookbackReduction: u32 = 0u;
        var k: u32 = partitionIndex;
        var done: bool = false;
        loop {
            if (done) { break; }
            let flagPayload = atomicLoad(&b_passHist[passHistOffset(pass_, k) + TID]);
            let flag = flagPayload & FLAG_MASK;

            if (flag == FLAG_INCLUSIVE) {
                lookbackReduction = lookbackReduction + (flagPayload >> 2u);
                if (partitionIndex + 1u < threadBlocks) {
                    // Flip FLAG_REDUCTION (01) to FLAG_INCLUSIVE (10) by adding
                    // 1, and fold in the full exclusive prefix so downstream
                    // blocks can terminate their lookback on this slot.
                    let dst = passHistOffset(pass_, partitionIndex + 1u) + TID;
                    atomicAdd(&b_passHist[dst], 1u | (lookbackReduction << 2u));
                }
                // Convert digit_base[TID] from block-local base to the value
                // needed during scatter: globalPrefix - blockLocalExclusive.
                digit_base[TID] = lookbackReduction - myDigitBase;
                done = true;
            } else if (flag == FLAG_REDUCTION) {
                lookbackReduction = lookbackReduction + (flagPayload >> 2u);
                // Scan kernel writes block 0's slot as FLAG_INCLUSIVE, so we
                // must see that before underflowing. Guard anyway.
                if (k == 0u) { done = true; }
                else { k = k - 1u; }
            }
            // FLAG_NOT_READY: spin on the same slot.
        }
    }

    // ---- Phase E: scatter keys into shared-memory staging ----
    for (var i = 0u; i < KEYS_PER_THREAD; i = i + 1u) {
        if (((validMask >> i) & 1u) == 1u) {
            atomicStore(&g_d[scatterPos[i]], keys[i]);
        }
    }
    workgroupBarrier();

    // ---- Phase F: linear key read → coalesced global write ----
    var linearDigits: array<u32, {KEYS_PER_THREAD}>;
    for (var r = 0u; r < KEYS_PER_THREAD; r = r + 1u) {
        let linearIdx = TID + r * D_DIM;
        if (linearIdx < validInBlock) {
            let k = atomicLoad(&g_d[linearIdx]);
            let digit = (k >> currentBit) & RADIX_MASK;
            linearDigits[r] = digit;
            let globalPos = digit_base[digit] + linearIdx;
            if (!isLastPass) {
                outputKeys[globalPos] = k;
            }
        }
    }
    workgroupBarrier();

    // ---- Phase G: scatter values into staging ----
    // Values were loaded into registers in phase A.2; reuse them here.
    for (var i = 0u; i < KEYS_PER_THREAD; i = i + 1u) {
        if (((validMask >> i) & 1u) == 1u) {
            atomicStore(&g_d[scatterPos[i]], values[i]);
        }
    }
    workgroupBarrier();

    // ---- Phase H: linear value read → coalesced global write ----
    for (var r = 0u; r < KEYS_PER_THREAD; r = r + 1u) {
        let linearIdx = TID + r * D_DIM;
        if (linearIdx < validInBlock) {
            let v = atomicLoad(&g_d[linearIdx]);
            let digit = linearDigits[r];
            let globalPos = digit_base[digit] + linearIdx;
            outputValues[globalPos] = v;
        }
    }
}
`;

export default onesweepBinningSource;
