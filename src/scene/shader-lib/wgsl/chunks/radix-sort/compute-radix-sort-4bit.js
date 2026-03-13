// 4-bit Radix Sort - Histogram pass
// Each thread processes ELEMENTS_PER_THREAD keys, reducing workgroup count proportionally.
// Computes per-workgroup digit histograms (block sums) only.

export const radixSort4bitSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> block_sums: array<u32>;

struct RadixSortUniforms {
    workgroupCount: u32,
    elementCount: u32
};
@group(0) @binding(2) var<uniform> uniforms: RadixSortUniforms;

#ifdef USE_INDIRECT_SORT
    @group(0) @binding(3) var<storage, read> sortElementCount: array<u32>;
#endif

const THREADS_PER_WORKGROUP: u32 = {THREADS_PER_WORKGROUP}u;
const WORKGROUP_SIZE_X: u32 = {WORKGROUP_SIZE_X}u;
const WORKGROUP_SIZE_Y: u32 = {WORKGROUP_SIZE_Y}u;
const CURRENT_BIT: u32 = {CURRENT_BIT}u;
const ELEMENTS_PER_THREAD: u32 = {ELEMENTS_PER_THREAD}u;
const ELEMENTS_PER_WORKGROUP: u32 = THREADS_PER_WORKGROUP * ELEMENTS_PER_THREAD;

var<workgroup> histogram: array<atomic<u32>, 16>;

@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn main(
    @builtin(workgroup_id) w_id: vec3<u32>,
    @builtin(num_workgroups) w_dim: vec3<u32>,
    @builtin(local_invocation_index) TID: u32,
) {
    let WORKGROUP_ID = w_id.x + w_id.y * w_dim.x;
    let WID = WORKGROUP_ID * ELEMENTS_PER_WORKGROUP;

    if (TID < 16u) {
        atomicStore(&histogram[TID], 0u);
    }
    workgroupBarrier();

    #ifdef USE_INDIRECT_SORT
        let elementCount = sortElementCount[0];
    #else
        let elementCount = uniforms.elementCount;
    #endif

    for (var r = 0u; r < ELEMENTS_PER_THREAD; r++) {
        let GID = WID + r * THREADS_PER_WORKGROUP + TID;
        let is_valid = GID < elementCount && WORKGROUP_ID < uniforms.workgroupCount;

        if (is_valid) {
            let elm = input[GID];
            let digit = (elm >> CURRENT_BIT) & 0xFu;
            atomicAdd(&histogram[digit], 1u);
        }
    }
    workgroupBarrier();

    if (TID < 16u && WORKGROUP_ID < uniforms.workgroupCount) {
        block_sums[TID * uniforms.workgroupCount + WORKGROUP_ID] = atomicLoad(&histogram[TID]);
    }
}
`;

export default radixSort4bitSource;
