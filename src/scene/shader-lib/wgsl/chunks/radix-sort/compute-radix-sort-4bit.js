// 4-bit Radix Sort - Compute local prefix sums and block sums
// Uses atomic histogram for block sums (fast), and vectorized counting for local prefix (stable)
// Each element computes its local prefix sum (how many elements with same digit came before in workgroup)

export const radixSort4bitSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> local_prefix_sums: array<u32>;
@group(0) @binding(2) var<storage, read_write> block_sums: array<u32>;

// Uniforms (values that change per-sort)
struct RadixSortUniforms {
    workgroupCount: u32,
    elementCount: u32
};
@group(0) @binding(3) var<uniform> uniforms: RadixSortUniforms;

// Compile-time constants
const THREADS_PER_WORKGROUP: u32 = {THREADS_PER_WORKGROUP}u;
const WORKGROUP_SIZE_X: u32 = {WORKGROUP_SIZE_X}u;
const WORKGROUP_SIZE_Y: u32 = {WORKGROUP_SIZE_Y}u;
const CURRENT_BIT: u32 = {CURRENT_BIT}u;

// Shared memory
var<workgroup> histogram: array<atomic<u32>, 16>;
var<workgroup> thread_digits: array<u32, 256>;  // Store each thread's digit

@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn radix_sort(
    @builtin(workgroup_id) w_id: vec3<u32>,
    @builtin(num_workgroups) w_dim: vec3<u32>,
    @builtin(local_invocation_index) TID: u32,
) {
    let WORKGROUP_ID = w_id.x + w_id.y * w_dim.x;
    let WID = WORKGROUP_ID * THREADS_PER_WORKGROUP;
    let GID = WID + TID;

    // Initialize histogram (first 16 threads)
    if (TID < 16u) {
        atomicStore(&histogram[TID], 0u);
    }
    workgroupBarrier();

    // Extract 4 bits from the input (0-15), use 16 as invalid marker
    let is_valid = GID < uniforms.elementCount && WORKGROUP_ID < uniforms.workgroupCount;
    let elm = select(0u, input[GID], is_valid);
    let digit: u32 = select(16u, (elm >> CURRENT_BIT) & 0xFu, is_valid);

    // Store digit in shared memory for other threads to read
    thread_digits[TID] = digit;

    // Build histogram using atomics (fast)
    if (is_valid) {
        atomicAdd(&histogram[digit], 1u);
    }
    workgroupBarrier();

    // Count threads with same digit and lower TID (maintains stability)
    // Vectorized: check 4 threads at a time
    var local_prefix: u32 = 0u;
    if (is_valid) {
        let digit_vec = vec4<u32>(digit, digit, digit, digit);
        let ones = vec4<u32>(1u, 1u, 1u, 1u);
        let zeros = vec4<u32>(0u, 0u, 0u, 0u);
        
        // Main loop: process 4 threads at a time
        var i: u32 = 0u;
        let limit = TID & ~3u;  // Round down to multiple of 4
        for (; i < limit; i += 4u) {
            let d = vec4<u32>(
                thread_digits[i],
                thread_digits[i + 1u],
                thread_digits[i + 2u],
                thread_digits[i + 3u]
            );
            let matches = select(zeros, ones, d == digit_vec);
            local_prefix += matches.x + matches.y + matches.z + matches.w;
        }
        
        // Handle remainder (0-3 elements)
        for (; i < TID; i++) {
            local_prefix += select(0u, 1u, thread_digits[i] == digit);
        }
    }

    // Write results
    if (is_valid) {
        local_prefix_sums[GID] = local_prefix;
    }

    // Store block sums (histogram values) to global memory
    if (TID < 16u && WORKGROUP_ID < uniforms.workgroupCount) {
        block_sums[TID * uniforms.workgroupCount + WORKGROUP_ID] = atomicLoad(&histogram[TID]);
    }
}
`;

export default radixSort4bitSource;
