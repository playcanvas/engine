// 4-bit Radix Sort - Ranked Scatter pass
// Processes ELEMENTS_PER_THREAD elements per thread across multiple rounds.
// Each round: sets bits in per-digit 256-bit bitmasks, computes local ranks via
// hardware popcount, then scatters using global prefix + cumulative local rank.
// Eliminates the local_prefix_sums buffer.

export const radixSortReorderSource = /* wgsl */`

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

var<workgroup> digit_masks: array<atomic<u32>, 128>;
var<workgroup> digit_offsets: array<u32, 16>;

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

    // Initialize cumulative offsets and clear bitmasks
    if (TID < 16u) {
        digit_offsets[TID] = 0u;
    }
    if (TID < 128u) {
        atomicStore(&digit_masks[TID], 0u);
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
        let digit = select(16u, (k >> CURRENT_BIT) & 0xFu, is_valid);

        // Pre-fetch value before barrier so GPU can overlap fetch with ranking
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

        // Update cumulative offsets and clear masks for next round
        if (round < ELEMENTS_PER_THREAD - 1u) {
            workgroupBarrier();
            if (TID < 16u) {
                var count = 0u;
                for (var w = 0u; w < 8u; w++) {
                    let idx = TID * 8u + w;
                    count += countOneBits(atomicLoad(&digit_masks[idx]));
                    atomicStore(&digit_masks[idx], 0u);
                }
                digit_offsets[TID] += count;
            }
            workgroupBarrier();
        }
    }
}
`;

export default radixSortReorderSource;
