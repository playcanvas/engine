// 8-bit Radix Sort - Subgroup-ranked Scatter pass
//
// Alternative 8-bit reorder that replaces the shared-memory digit bitmask with
// per-bit subgroup-ballot intersections. The per-element ranking cost drops
// from "1 atomicOr + up to 8 atomicLoads + popcounts" to "8 ballot-select-and
// ops in registers + 1 popcount", trading shared-memory atomic traffic for
// hardware subgroup ops.
//
// Algorithm, per round (8 rounds per pass, 4 passes for 32-bit keys):
//  1. Read one key, compute its 8-bit digit.
//  2. For each of the 8 digit bits b, subgroupBallot(digit_bit_b_is_set):
//       mask_b = ballot if my bit_b is 1 else ~ballot
//     Intersecting mask_0..7 across all 8 bits yields `sameDigitMask`: the set
//     of lanes in my subgroup that share my full 8-bit digit.
//  3. Intra-subgroup rank = popcount(sameDigitMask & lanes_below_me).
//  4. Exactly one lane per (subgroup, digit) run writes its bucketCount to
//     `warpCounts[sgId * 256 + digit]` for the deterministic inter-subgroup
//     combine.
//  5. Global rank = prefix_block_sum[digit][wg] + digit_offsets[digit]
//                 + sum(earlier sgs' warpCounts[*][digit]) + intraRank.
//  6. End of round: fold each subgroup's counts into digit_offsets, clear
//     warpCounts for the next round.
//
// Stability: intraRank orders same-digit lanes by lane ID (stable); the
// per-thread accumulation over earlier subgroups is deterministic in sgId
// order, so inter-subgroup ordering is stable too. Across rounds, the
// digit_offsets accumulator preserves prior-round positions.
//
// Shared memory footprint: 256 digits × 8 subgroups × 4 B = 8 KB warpCounts
// + 256 × 4 B = 1 KB digit_offsets = 9 KB total. Same as the shared-memory
// variant; occupancy on Apple is therefore identical between the two. The
// hypothesised win is purely from replacing shared-memory atomic chains with
// subgroup intrinsics and register popcounts.
//
// Subgroup-size handling: `MAX_SUBGROUPS` is parametrized by the host from
// `device.maxSubgroupSize` (256 / sgSize), so this shader correctly sizes
// `warpCounts` for sgSize ∈ {16, 32}.
// It is NOT safe for sgSize > 32 (AMD wave64, some Adreno) because the
// `.x`-only ballot component drops lanes ≥32; that architecture needs a
// separate kernel and is handled by the multipass 4-bit fallback at the
// ComputeRadixSort level.

export const radixSort8bitSubgroupReorderSource = /* wgsl */`

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

// Parametrized by the host from device.maxSubgroupSize (256 / sgSize).
const MAX_SUBGROUPS: u32 = {MAX_SUBGROUPS}u;

// Per-subgroup per-digit counts for the current round. One write per
// (subgroup, digit) pair (the "leader" lane of each same-digit run), so
// plain stores are race-free without atomics.
var<workgroup> warpCounts: array<u32, 256 * MAX_SUBGROUPS>;

// Running per-digit offset accumulated across rounds (exclusive to this
// round's in-progress lanes).
var<workgroup> digit_offsets: array<u32, 256>;

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
    let sgId = TID / sgSize;
    let sgInvMask = (1u << sgInvId) - 1u;
    // Active-lane mask for the match-any ballot below. WGSL says inactive-lane
    // bits of subgroupBallot are 0, but drivers (notably Mali / Imagination
    // at sgSize<32) don't always honour this for subgroupBallot(is_valid).
    // Initialising sameDigitMask to only cover active lanes makes the per-bit
    // AND-chain correct regardless of driver behaviour. \`1u << 32u\` is UB so
    // branch on sgSize < 32.
    let activeMask = select(0xFFFFFFFFu, (1u << sgSize) - 1u, sgSize < 32u);

    // Clear digit_offsets (1 per thread) and warpCounts (8 per thread at
    // stride 256 — one slot per subgroup for this thread's digit column).
    digit_offsets[TID] = 0u;
    for (var w = 0u; w < MAX_SUBGROUPS; w++) {
        warpCounts[w * 256u + TID] = 0u;
    }
    workgroupBarrier();

    #ifdef USE_INDIRECT_SORT
        let elementCount = sortElementCount[0];
    #else
        let elementCount = uniforms.elementCount;
    #endif

    for (var round = 0u; round < ELEMENTS_PER_THREAD; round++) {
        let GID = WID + round * THREADS_PER_WORKGROUP + TID;
        let is_valid = GID < elementCount;

        let k = select(0u, inputKeys[GID], is_valid);
        let digit = (k >> CURRENT_BIT) & 0xFFu;

        // Pre-fetch the value before the ranking phase so the GPU can overlap
        // the load with ballot work.
        let v = select(0u, select(inputValues[GID], GID, IS_FIRST_PASS == 1u), is_valid);

        // ----- Subgroup-local match-any via per-bit ballot intersection -----
        // For each bit b of the 8-bit digit, subgroupBallot returns a mask of
        // lanes whose bit_b is set. If my bit_b is 1, my same-digit peers are
        // in that mask; if 0, they are in its complement. Intersecting across
        // all 8 bits leaves only lanes that share my full digit.
        //
        // NOTE on .x-only: correct iff sgSize <= 32. See header comment.
        var sameDigitMask: u32 = activeMask;
        for (var b = 0u; b < 8u; b++) {
            let myBit = ((digit >> b) & 1u) == 1u;
            let ballot = subgroupBallot(myBit).x;
            sameDigitMask = sameDigitMask & select(~ballot, ballot, myBit);
        }
        // Drop invalid lanes from the mask (their digit is 0 from the select
        // above, which otherwise collides with real digit-0 lanes).
        let validBallot = subgroupBallot(is_valid).x;
        sameDigitMask = sameDigitMask & validBallot;

        let intraRank = countOneBits(sameDigitMask & sgInvMask);
        let bucketCount = countOneBits(sameDigitMask);

        // First valid lane in each same-digit run within this subgroup is the
        // leader — it writes the shared count. firstTrailingBit(0) returns
        // 0xFFFFFFFFu which never equals sgInvId, so lanes whose sameDigitMask
        // is empty (only possible when is_valid == false) skip the write.
        let isLeaderOfRun = is_valid && (sgInvId == firstTrailingBit(sameDigitMask));
        if (isLeaderOfRun) {
            warpCounts[sgId * 256u + digit] = bucketCount;
        }

        workgroupBarrier();

        if (is_valid) {
            // Sum counts from earlier subgroups for my digit. Deterministic
            // in sgId order, so inter-subgroup ordering is stable.
            var rank = digit_offsets[digit] + intraRank;
            for (var w = 0u; w < sgId; w++) {
                rank += warpCounts[w * 256u + digit];
            }

            let pid = digit * uniforms.workgroupCount + WORKGROUP_ID;
            let sorted_position = prefix_block_sum[pid] + rank;

            if (IS_LAST_PASS == 0u) {
                outputKeys[sorted_position] = k;
            }
            outputValues[sorted_position] = v;
        }

        // End-of-round: fold each subgroup's counts for this thread's digit
        // (== TID) into digit_offsets, then zero warpCounts for the next
        // round. Skipped on the final round (offsets never read again).
        if (round < ELEMENTS_PER_THREAD - 1u) {
            workgroupBarrier();
            var total = 0u;
            for (var w = 0u; w < MAX_SUBGROUPS; w++) {
                let idx = w * 256u + TID;
                total += warpCounts[idx];
                warpCounts[idx] = 0u;
            }
            digit_offsets[TID] += total;
            workgroupBarrier();
        }
    }
}
`;

export default radixSort8bitSubgroupReorderSource;
