// 8-bit Radix Sort - Histogram pass
// Each thread processes ELEMENTS_PER_THREAD keys, reducing workgroup count proportionally.
// Computes per-workgroup digit histograms (block sums) only.
//
// Halves the number of radix passes vs 4-bit (4 passes for 32-bit keys instead of 8),
// at the cost of 16x larger block sums and 8 KB of shared memory for the reorder pass.
//
// Requires subgroup support on the host side. The histogram itself does not call any
// subgroup intrinsics today, but 8-bit mode as a whole (reorder in particular) is
// gated on `device.supportsSubgroups` so we can freely add subgroup-accelerated
// ranking later without breaking the fallback path.

export const radixSort8bitHistogramSource = /* wgsl */`

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

// 256 buckets, one per 8-bit digit value. Workgroup has exactly 256 threads so
// each thread owns one bucket for init and export.
var<workgroup> histogram: array<atomic<u32>, 256>;

@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn main(
    @builtin(workgroup_id) w_id: vec3<u32>,
    @builtin(num_workgroups) w_dim: vec3<u32>,
    @builtin(local_invocation_index) TID: u32,
) {
    let WORKGROUP_ID = w_id.x + w_id.y * w_dim.x;
    let WID = WORKGROUP_ID * ELEMENTS_PER_WORKGROUP;

    atomicStore(&histogram[TID], 0u);
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
            let digit = (elm >> CURRENT_BIT) & 0xFFu;
            atomicAdd(&histogram[digit], 1u);
        }
    }
    workgroupBarrier();

    if (WORKGROUP_ID < uniforms.workgroupCount) {
        block_sums[TID * uniforms.workgroupCount + WORKGROUP_ID] = atomicLoad(&histogram[TID]);
    }
}
`;

export default radixSort8bitHistogramSource;
