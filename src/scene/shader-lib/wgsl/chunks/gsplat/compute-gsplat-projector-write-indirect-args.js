// Single-thread compute shader that reads the post-projection visible count from
// renderCounter[0] (written by compute-gsplat-projector.js) and produces:
//   - the indexed indirect draw args for the hybrid quad raster pass,
//   - numSplatsBuf[0] for the vertex shader,
//   - sortElementCountBuf[0] for the radix sort,
//   - the indirect dispatch args for the radix sort (via writeSortIndirectArgs).
//
// Same overall shape as compute-gsplat-write-indirect-args.js, but it sources the
// element count from renderCounter (atomic counter populated per-workgroup by the
// projector) instead of prefixSumBuffer[totalSplats]. There is no separate keygen
// dispatch — sort keys are produced inline by the projector pass.

import indirectCoreCS from '../common/comp/indirect-core.js';
import dispatchCoreCS from '../common/comp/dispatch-core.js';
import sortIndirectArgsCS from '../common/comp/sort-indirect-args.js';

export const computeGsplatProjectorWriteIndirectArgsSource = /* wgsl */`

${indirectCoreCS}
${dispatchCoreCS}
${sortIndirectArgsCS}

@group(0) @binding(0) var<storage, read> renderCounter: array<u32>;
@group(0) @binding(1) var<storage, read_write> indirectDrawArgs: array<DrawIndexedIndirectArgs>;
@group(0) @binding(2) var<storage, read_write> numSplatsBuf: array<u32>;
@group(0) @binding(3) var<storage, read_write> indirectDispatchArgs: array<u32>;
@group(0) @binding(4) var<storage, read_write> sortElementCountBuf: array<u32>;

struct WriteArgsUniforms {
    drawSlot: u32,
    indexCount: u32,
    sortSlotBase: u32,
    pad0: u32,
    sortIndirectInfo: vec4<u32>
};
@group(0) @binding(5) var<uniform> uniforms: WriteArgsUniforms;

@compute @workgroup_size(1)
fn main() {
    let count = renderCounter[0];
    let instanceCount = (count + {INSTANCE_SIZE}u - 1u) / {INSTANCE_SIZE}u;

    indirectDrawArgs[uniforms.drawSlot] = DrawIndexedIndirectArgs(
        uniforms.indexCount,
        instanceCount,
        0u,
        0,
        0u
    );

    numSplatsBuf[0] = count;
    sortElementCountBuf[0] = count;

    // Sort dispatch args at sortSlotBase (no keygen slot — sort keys come from the
    // projector pass directly).
    writeSortIndirectArgs(&indirectDispatchArgs, uniforms.sortSlotBase, count, uniforms.sortIndirectInfo);
}
`;

export default computeGsplatProjectorWriteIndirectArgsSource;
