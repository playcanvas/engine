// 4-bit Radix Sort Reorder - Scatter elements to their sorted positions
// Uses local prefix sum + global block prefix sum to compute final position
// Based on webgpu-radix-sort algorithm, extended to 4-bit (16 buckets)

export const radixSortReorderSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> inputKeys: array<u32>;
@group(0) @binding(1) var<storage, read_write> outputKeys: array<u32>;
@group(0) @binding(2) var<storage, read> local_prefix_sum: array<u32>;
@group(0) @binding(3) var<storage, read> prefix_block_sum: array<u32>;
@group(0) @binding(4) var<storage, read> inputValues: array<u32>;
@group(0) @binding(5) var<storage, read_write> outputValues: array<u32>;

// Uniforms (values that change per-sort)
struct RadixSortUniforms {
    workgroupCount: u32,
    elementCount: u32
};
@group(0) @binding(6) var<uniform> uniforms: RadixSortUniforms;

#ifdef USE_INDIRECT_SORT
    // GPU-written element count
    @group(0) @binding(7) var<storage, read> sortElementCount: array<u32>;
#endif

// Compile-time constants
const THREADS_PER_WORKGROUP: u32 = {THREADS_PER_WORKGROUP}u;
const WORKGROUP_SIZE_X: u32 = {WORKGROUP_SIZE_X}u;
const WORKGROUP_SIZE_Y: u32 = {WORKGROUP_SIZE_Y}u;
const CURRENT_BIT: u32 = {CURRENT_BIT}u;
const IS_FIRST_PASS: u32 = {IS_FIRST_PASS}u;

@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn main(
    @builtin(workgroup_id) w_id: vec3<u32>,
    @builtin(num_workgroups) w_dim: vec3<u32>,
    @builtin(local_invocation_index) TID: u32,
) {
    let WORKGROUP_ID = w_id.x + w_id.y * w_dim.x;
    let WID = WORKGROUP_ID * THREADS_PER_WORKGROUP;
    let GID = WID + TID;

    // Read element count: from storage buffer (GPU-written) or uniform (CPU-set)
    #ifdef USE_INDIRECT_SORT
        let elementCount = sortElementCount[0];
    #else
        let elementCount = uniforms.elementCount;
    #endif

    if (GID >= elementCount) {
        return;
    }

    let k = inputKeys[GID];
    // On first pass, indices are sequential [0,1,2...], so use GID directly
    let v = select(inputValues[GID], GID, IS_FIRST_PASS == 1u);

    let local_prefix = local_prefix_sum[GID];

    // Calculate new position
    // Extract 4 bits (0-15)
    let extract_bits = (k >> CURRENT_BIT) & 0xFu;
    
    // Block sum index: digit * workgroup_count + workgroup_id
    let pid = extract_bits * uniforms.workgroupCount + WORKGROUP_ID;
    let sorted_position = prefix_block_sum[pid] + local_prefix;

    outputKeys[sorted_position] = k;
    outputValues[sorted_position] = v;
}
`;

export default radixSortReorderSource;
