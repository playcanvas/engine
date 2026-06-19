// Single-thread compute shader that reads the visible shadow-splat count and writes the indexed
// indirect draw arguments for a directional-shadow gsplat draw.
//
// The count is produced by the fused shadow cull (an atomic counter), and is also bound directly to
// the draw material as `numSplatsStorage` so the vertex shader reads the same value. This shader
// only needs to turn the count into an instance count for the indirect draw.

import indirectCoreCS from '../common/comp/indirect-core.js';

export const computeGsplatShadowIndirectArgsSource = /* wgsl */`

${indirectCoreCS}

// Visible splat count (element 0), produced by the shadow cull's atomic counter.
@group(0) @binding(0) var<storage, read> countBuffer: array<u32>;

// Device's shared indirect draw buffer, indexed by slot.
@group(0) @binding(1) var<storage, read_write> indirectDrawArgs: array<DrawIndexedIndirectArgs>;

struct ShadowArgsUniforms {
    drawSlot: u32,      // slot index into indirectDrawArgs
    indexCount: u32,    // indices per instance (768 = 6 * 128)
    pad0: u32,
    pad1: u32
};
@group(0) @binding(2) var<uniform> uniforms: ShadowArgsUniforms;

@compute @workgroup_size(1)
fn main() {
    let count = countBuffer[0];
    let instanceCount = (count + {INSTANCE_SIZE}u - 1u) / {INSTANCE_SIZE}u;

    indirectDrawArgs[uniforms.drawSlot] = DrawIndexedIndirectArgs(
        uniforms.indexCount,
        instanceCount,
        0u,     // firstIndex
        0,      // baseVertex
        0u      // firstInstance
    );
}
`;

export default computeGsplatShadowIndirectArgsSource;
