// Parallel Prefix Sum (Scan) using Blelloch algorithm
// Based on "Parallel Prefix Sum (Scan) with CUDA"
// https://www.eecs.umich.edu/courses/eecs570/hw/parprefix.pdf
// Ported from webgpu-radix-sort (MIT License)

export const prefixSumSource = /* wgsl */`

@group(0) @binding(0) var<storage, read_write> items: array<u32>;
@group(0) @binding(1) var<storage, read_write> blockSums: array<u32>;

// Uniform for runtime element count (changes per-sort without shader recompilation)
struct PrefixSumUniforms {
    elementCount: u32
};
@group(0) @binding(2) var<uniform> uniforms: PrefixSumUniforms;

// Compile-time constants
const WORKGROUP_SIZE_X: u32 = {WORKGROUP_SIZE_X}u;
const WORKGROUP_SIZE_Y: u32 = {WORKGROUP_SIZE_Y}u;
const THREADS_PER_WORKGROUP: u32 = {THREADS_PER_WORKGROUP}u;
const ITEMS_PER_WORKGROUP: u32 = {ITEMS_PER_WORKGROUP}u;

var<workgroup> temp: array<u32, ITEMS_PER_WORKGROUP * 2>;

@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn reduce_downsweep(
    @builtin(workgroup_id) w_id: vec3<u32>,
    @builtin(num_workgroups) w_dim: vec3<u32>,
    @builtin(local_invocation_index) TID: u32,
) {
    let WORKGROUP_ID = w_id.x + w_id.y * w_dim.x;
    let WID = WORKGROUP_ID * THREADS_PER_WORKGROUP;
    let GID = WID + TID;
    
    let ELM_TID = TID * 2;
    let ELM_GID = GID * 2;
    
    // Load input to shared memory
    temp[ELM_TID] = select(items[ELM_GID], 0u, ELM_GID >= uniforms.elementCount);
    temp[ELM_TID + 1u] = select(items[ELM_GID + 1u], 0u, ELM_GID + 1u >= uniforms.elementCount);

    var offset: u32 = 1u;

    // Up-sweep (reduce) phase
    for (var d: u32 = ITEMS_PER_WORKGROUP >> 1u; d > 0u; d >>= 1u) {
        workgroupBarrier();

        if (TID < d) {
            var ai: u32 = offset * (ELM_TID + 1u) - 1u;
            var bi: u32 = offset * (ELM_TID + 2u) - 1u;
            temp[bi] += temp[ai];
        }

        offset *= 2u;
    }

    // Save workgroup sum and clear last element
    if (TID == 0u) {
        let last_offset = ITEMS_PER_WORKGROUP - 1u;
        blockSums[WORKGROUP_ID] = temp[last_offset];
        temp[last_offset] = 0u;
    }

    // Down-sweep phase
    for (var d: u32 = 1u; d < ITEMS_PER_WORKGROUP; d *= 2u) {
        offset >>= 1u;
        workgroupBarrier();

        if (TID < d) {
            var ai: u32 = offset * (ELM_TID + 1u) - 1u;
            var bi: u32 = offset * (ELM_TID + 2u) - 1u;

            let t: u32 = temp[ai];
            temp[ai] = temp[bi];
            temp[bi] += t;
        }
    }
    workgroupBarrier();

    // Copy result from shared memory to global memory
    if (ELM_GID < uniforms.elementCount) {
        items[ELM_GID] = temp[ELM_TID];
    }

    if (ELM_GID + 1u < uniforms.elementCount) {
        items[ELM_GID + 1u] = temp[ELM_TID + 1u];
    }
}

@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn add_block_sums(
    @builtin(workgroup_id) w_id: vec3<u32>,
    @builtin(num_workgroups) w_dim: vec3<u32>,
    @builtin(local_invocation_index) TID: u32,
) {
    let WORKGROUP_ID = w_id.x + w_id.y * w_dim.x;
    let WID = WORKGROUP_ID * THREADS_PER_WORKGROUP;
    let GID = WID + TID;

    let ELM_ID = GID * 2u;

    if (ELM_ID >= uniforms.elementCount) {
        return;
    }

    let blockSum = blockSums[WORKGROUP_ID];

    items[ELM_ID] += blockSum;

    if (ELM_ID + 1u >= uniforms.elementCount) {
        return;
    }

    items[ELM_ID + 1u] += blockSum;
}
`;

export default prefixSumSource;
