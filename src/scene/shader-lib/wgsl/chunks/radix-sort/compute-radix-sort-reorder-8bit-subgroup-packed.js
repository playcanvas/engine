// 8-bit Radix Sort - Subgroup-ranked Scatter pass with packed warpCounts
//
// Variant of the subgroup-ballot reorder (see compute-radix-sort-reorder-8bit-
// subgroup.js) that shrinks `warpCounts` from 8 KB to 2 KB by packing each
// subgroup's 8-bit count into a shared u32 slot. Correctness is preserved by
// using `atomicOr` with disjoint bit ranges, so writes from different
// subgroups for the same digit never collide.
//
// Layout (8 subgroups, 4 subgroups per u32, 2 words per digit):
//   warpCountsPacked[digit * 2 + 0]: sg0..3 counts in bytes 0..3
//   warpCountsPacked[digit * 2 + 1]: sg4..7 counts in bytes 0..3
//
// Total shared memory: 256 digits × 2 × 4 B = 2 KB warpCounts + 1 KB
// digit_offsets = 3 KB (vs 9 KB for the non-packed variant). Lower shared
// memory can improve occupancy on GPUs that are shared-memory limited.
//
// Trade-offs vs non-packed subgroup variant:
//  + 1/4 the shared memory for warpCounts.
//  - atomicOr on writes (disjoint bits, so no contention within a word, but
//    still atomic traffic).
//  - Inter-subgroup read loop now shifts-and-masks per subgroup (a few extra
//    cheap ALU ops per earlier subgroup).
//  - End-of-round fold loads 2 words and does 8 byte extractions per digit
//    instead of 8 full-word loads.
//
// Subgroup-size assumption: identical to the non-packed variant — correct
// only for sgSize == 32 (8 subgroups in a 256-thread workgroup). The byte
// packing hard-codes 4 subgroups per u32; adjusting for other sgSize would
// need either more words per digit (sgSize < 32) or wider packing (sgSize
// > 32, which also invalidates the `.x`-only ballot).

export const radixSort8bitSubgroupPackedReorderSource = /* wgsl */`

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

// Assumes sgSize == 32 → 256 threads = 8 subgroups. See header comment.
const MAX_SUBGROUPS: u32 = 8u;
const SUBGROUPS_PER_WORD: u32 = 4u;
const WORDS_PER_DIGIT: u32 = MAX_SUBGROUPS / SUBGROUPS_PER_WORD; // 2

// Packed per-(subgroup, digit) counts: 4 subgroups per u32, 2 words per digit.
// Each subgroup leader writes its count into its dedicated byte using atomicOr,
// so writes within a word are disjoint and cannot clobber each other. The bit
// width (8) is sufficient because bucketCount <= sgSize (32).
var<workgroup> warpCountsPacked: array<atomic<u32>, 256u * WORDS_PER_DIGIT>;

// Running per-digit offset accumulated across rounds.
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

    // Precompute this thread's subgroup slot/shift so the per-round write
    // only needs a single atomicOr with a prebuilt value.
    let mySlot = sgId / SUBGROUPS_PER_WORD;
    let myShift = (sgId % SUBGROUPS_PER_WORD) * 8u;

    // Init shared memory. 256 threads, 512 warpCountsPacked slots → 2 per thread.
    digit_offsets[TID] = 0u;
    atomicStore(&warpCountsPacked[TID * WORDS_PER_DIGIT], 0u);
    atomicStore(&warpCountsPacked[TID * WORDS_PER_DIGIT + 1u], 0u);
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
        let v = select(0u, select(inputValues[GID], GID, IS_FIRST_PASS == 1u), is_valid);

        // Match-any via per-bit ballot intersection. See non-packed variant.
        var sameDigitMask: u32 = 0xFFFFFFFFu;
        for (var b = 0u; b < 8u; b++) {
            let myBit = ((digit >> b) & 1u) == 1u;
            let ballot = subgroupBallot(myBit).x;
            sameDigitMask = sameDigitMask & select(~ballot, ballot, myBit);
        }
        let validBallot = subgroupBallot(is_valid).x;
        sameDigitMask = sameDigitMask & validBallot;

        let intraRank = countOneBits(sameDigitMask & sgInvMask);
        let bucketCount = countOneBits(sameDigitMask);

        // Leader of each same-digit run in this subgroup publishes the count
        // into its dedicated byte in the packed slot. Different subgroups
        // writing the same digit target disjoint bytes of the same u32, so
        // atomicOr merges them without loss.
        let isLeaderOfRun = is_valid && (sgInvId == firstTrailingBit(sameDigitMask));
        if (isLeaderOfRun) {
            atomicOr(&warpCountsPacked[digit * WORDS_PER_DIGIT + mySlot], bucketCount << myShift);
        }

        workgroupBarrier();

        if (is_valid) {
            // Walk earlier subgroups in sgId order (stable) and extract their
            // byte from the packed word. Reading the other subgroups for the
            // same digit always touches at most 2 distinct u32 words (vs 8
            // scalar loads in the non-packed variant).
            var rank = digit_offsets[digit] + intraRank;
            for (var w = 0u; w < sgId; w++) {
                let slot = w / SUBGROUPS_PER_WORD;
                let shift = (w % SUBGROUPS_PER_WORD) * 8u;
                let packed = atomicLoad(&warpCountsPacked[digit * WORDS_PER_DIGIT + slot]);
                rank += (packed >> shift) & 0xFFu;
            }

            let pid = digit * uniforms.workgroupCount + WORKGROUP_ID;
            let sorted_position = prefix_block_sum[pid] + rank;

            if (IS_LAST_PASS == 0u) {
                outputKeys[sorted_position] = k;
            }
            outputValues[sorted_position] = v;
        }

        // End-of-round: fold this thread's digit counts into digit_offsets
        // and clear the packed slots for the next round. Each thread owns
        // the two packed words for digit == TID.
        if (round < ELEMENTS_PER_THREAD - 1u) {
            workgroupBarrier();
            let idx0 = TID * WORDS_PER_DIGIT;
            let word0 = atomicLoad(&warpCountsPacked[idx0]);
            let word1 = atomicLoad(&warpCountsPacked[idx0 + 1u]);
            let total =
                  (word0         & 0xFFu)
                + ((word0 >>  8u) & 0xFFu)
                + ((word0 >> 16u) & 0xFFu)
                + ((word0 >> 24u) & 0xFFu)
                + (word1         & 0xFFu)
                + ((word1 >>  8u) & 0xFFu)
                + ((word1 >> 16u) & 0xFFu)
                + ((word1 >> 24u) & 0xFFu);
            digit_offsets[TID] += total;
            atomicStore(&warpCountsPacked[idx0], 0u);
            atomicStore(&warpCountsPacked[idx0 + 1u], 0u);
            workgroupBarrier();
        }
    }
}
`;

export default radixSort8bitSubgroupPackedReorderSource;
