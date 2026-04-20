// 8-bit Radix Sort - Ranked Scatter pass
// Direct scale-up of the 4-bit ranked-scatter algorithm to 256 buckets.
//
// Per round (8 rounds total):
//  1. Each thread reads one key, extracts its 8-bit digit.
//  2. Threads set a per-digit bit in a shared-memory bitmask (one u32 per
//     32-thread chunk of the workgroup).
//  3. Local rank = popcount of same-digit bits at lower word/bit positions,
//     plus a per-digit carry from earlier rounds.
//  4. Global scatter position = exclusive prefix from block_sums + local rank.
//
// Shared memory footprint: 256 digits * 8 words (u32) = 8 KB for digit_masks,
// plus 256 u32 = 1 KB for digit_offsets, totalling 9 KB per workgroup. This
// fits the WebGPU `maxComputeWorkgroupStorageSize` floor of 16 KB.
//
// Atomic contention: with 256 digits across 256 threads, expected contention
// on any single mask word is low (~1 thread per digit on uniformly-distributed
// input), meaningfully lower than the 4-bit version's ~16 threads per digit.
//
// Subgroup gate: 8-bit mode is enabled only when `device.supportsSubgroups`.
// The current shader does not yet use subgroup intrinsics (e.g. ballot-based
// match-any ranking) - that is a planned follow-up optimisation. The gate is
// kept strict to avoid dual-codepath maintenance for devices without subgroup
// support; those fall back to the 4-bit path end-to-end.

export const radixSort8bitReorderSource = /* wgsl */`

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

// Per-workgroup bitmasks: one 32-bit slot per (digit, 32-thread group). With
// THREADS_PER_WORKGROUP = 256 there are 8 such slots per digit.
var<workgroup> digit_masks: array<atomic<u32>, 2048>;

// Running per-digit offset that accumulates across rounds (exclusive to the
// current round's in-progress ranks).
var<workgroup> digit_offsets: array<u32, 256>;

@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn main(
    @builtin(workgroup_id) w_id: vec3<u32>,
    @builtin(num_workgroups) w_dim: vec3<u32>,
    @builtin(local_invocation_index) TID: u32,
) {
    let WORKGROUP_ID = w_id.x + w_id.y * w_dim.x;
    let WID = WORKGROUP_ID * ELEMENTS_PER_WORKGROUP;

    let word_idx = TID >> 5u;
    let bit_idx = TID & 31u;

    // Init cumulative offsets and bitmasks. Each thread owns 1 digit_offset
    // slot and 8 digit_mask slots (one per chunk word), so all 9 KB are
    // cleared with no branching.
    digit_offsets[TID] = 0u;
    let base_mask = TID * 8u;
    for (var w = 0u; w < 8u; w++) {
        atomicStore(&digit_masks[base_mask + w], 0u);
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
        // Sentinel digit 256 for invalid lanes so the mask store is skipped.
        let digit = select(256u, (k >> CURRENT_BIT) & 0xFFu, is_valid);

        // Pre-fetch the value before the barrier so the GPU can overlap the
        // fetch with ranking work in the next stage.
        let v = select(0u, select(inputValues[GID], GID, IS_FIRST_PASS == 1u), is_valid);

        if (is_valid) {
            atomicOr(&digit_masks[digit * 8u + word_idx], 1u << bit_idx);
        }
        workgroupBarrier();

        if (is_valid) {
            let base = digit * 8u;
            var local_prefix = digit_offsets[digit];
            for (var w = 0u; w < word_idx; w++) {
                local_prefix += countOneBits(atomicLoad(&digit_masks[base + w]));
            }
            local_prefix += countOneBits(atomicLoad(&digit_masks[base + word_idx]) & ((1u << bit_idx) - 1u));

            let pid = digit * uniforms.workgroupCount + WORKGROUP_ID;
            let sorted_position = prefix_block_sum[pid] + local_prefix;

            if (IS_LAST_PASS == 0u) {
                outputKeys[sorted_position] = k;
            }
            outputValues[sorted_position] = v;
        }

        // End-of-round: fold each digit's round count into digit_offsets,
        // then clear the mask words for the next round. Skipped on the final
        // round because the offsets are never read again.
        if (round < ELEMENTS_PER_THREAD - 1u) {
            workgroupBarrier();
            var count = 0u;
            for (var w = 0u; w < 8u; w++) {
                let idx = base_mask + w;
                count += countOneBits(atomicLoad(&digit_masks[idx]));
                atomicStore(&digit_masks[idx], 0u);
            }
            digit_offsets[TID] += count;
            workgroupBarrier();
        }
    }
}
`;

export default radixSort8bitReorderSource;
