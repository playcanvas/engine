// Single-thread compute shader that reads the visible splat count from the
// prefix sum buffer and writes indirect draw arguments, indirect dispatch
// arguments (key gen, sort), numSplats for the vertex shader,
// and sortElementCount for sort shaders.
//
// The visible count is obtained from prefixSumBuffer[totalSplats]. After the
// exclusive prefix sum over N+1 elements (N flags + 1 sentinel), the value at
// index N equals the total number of visible splats.

import indirectCoreCS from '../common/comp/indirect-core.js';
import dispatchCoreCS from '../common/comp/dispatch-core.js';
import sortIndirectArgsCS from '../common/comp/sort-indirect-args.js';

export const computeGsplatWriteIndirectArgsSource = /* wgsl */`

${indirectCoreCS}
${dispatchCoreCS}
${sortIndirectArgsCS}

// Prefix sum buffer (flagBuffer after in-place exclusive scan)
@group(0) @binding(0) var<storage, read> prefixSumBuffer: array<u32>;

// Indirect draw buffer (device's shared indirect draw buffer, indexed by slot)
@group(0) @binding(1) var<storage, read_write> indirectDrawArgs: array<DrawIndexedIndirectArgs>;

// numSplats storage buffer for vertex shader to read
@group(0) @binding(2) var<storage, read_write> numSplatsBuf: array<u32>;

// Indirect dispatch buffer (device's shared indirect dispatch buffer)
@group(0) @binding(3) var<storage, read_write> indirectDispatchArgs: array<u32>;

// sortElementCount storage buffer for sort shaders to read (visibleCount)
@group(0) @binding(4) var<storage, read_write> sortElementCountBuf: array<u32>;

// Uniforms
struct WriteArgsUniforms {
    drawSlot: u32,              // slot index into indirectDrawArgs
    indexCount: u32,            // indices per instance (768 = 6 * 128)
    dispatchSlotBase: u32,      // slot index of keygen dispatch; sort slots follow
    totalSplats: u32,           // total splat count, index into prefixSumBuffer for visible count
    sortIndirectInfo: vec4<u32> // sorter-owned [slotCount, g0, g1, g2] from prepareIndirect()
};
@group(0) @binding(5) var<uniform> uniforms: WriteArgsUniforms;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Read visible count from prefixSumBuffer[N] where N = totalSplats.
    // After exclusive prefix sum over N+1 elements, prefixSum[N] = total visible count.
    let count = prefixSumBuffer[uniforms.totalSplats];
    let instanceCount = (count + {INSTANCE_SIZE}u - 1u) / {INSTANCE_SIZE}u;

    // Write indexed indirect draw args
    indirectDrawArgs[uniforms.drawSlot] = DrawIndexedIndirectArgs(
        uniforms.indexCount,
        instanceCount,
        0u,     // firstIndex
        0,      // baseVertex
        0u      // firstInstance
    );

    // Write numSplats for vertex shader
    numSplatsBuf[0] = count;

    // --- Indirect dispatch args ---
    // Layout: slot[base + 0] = key gen, slot[base + 1..base + 1 + sortSlotCount] = sort.
    let keygenSlot = uniforms.dispatchSlotBase;
    let keygenOffset = keygenSlot * 3u;

    let keygenWorkgroupCount = (count + {KEYGEN_THREADS_PER_WORKGROUP}u - 1u) / {KEYGEN_THREADS_PER_WORKGROUP}u;
    let keygenDim = calcDispatch2D(keygenWorkgroupCount, {MAX_WORKGROUPS_PER_DIM}u);
    indirectDispatchArgs[keygenOffset + 0u] = keygenDim.x;
    indirectDispatchArgs[keygenOffset + 1u] = keygenDim.y;
    indirectDispatchArgs[keygenOffset + 2u] = 1u;

    // Sort dispatch slots — delegated to the sorter-agnostic helper so this
    // shader doesn't need to know how many slots or what granularity the
    // active radix sort backend uses.
    writeSortIndirectArgs(&indirectDispatchArgs, keygenSlot + 1u, count, uniforms.sortIndirectInfo);

    // Write sortElementCount for sort shaders (= visibleCount)
    sortElementCountBuf[0] = count;
}
`;

export default computeGsplatWriteIndirectArgsSource;
