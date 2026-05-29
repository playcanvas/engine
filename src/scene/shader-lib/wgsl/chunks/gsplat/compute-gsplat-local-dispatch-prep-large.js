// Tiny 1-thread shader that reads the large-splat count from countersBuffer[1] and
// computes indirect dispatch args for the cooperative large-splat tile-count pass.
export const computeGsplatLocalDispatchPrepLargeSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> countersBuffer: array<u32>;
@group(0) @binding(1) var<storage, read_write> dispatchArgs: array<u32>;
@group(0) @binding(2) var<storage, read> largeSplatIds: array<u32>;

@compute @workgroup_size(1)
fn main() {
    let count = min(countersBuffer[1], arrayLength(&largeSplatIds));
    let maxDim = {MAX_DIM}u;
    if (count <= maxDim) {
        dispatchArgs[0] = count;
        dispatchArgs[1] = 1u;
    } else {
        let y = (count + maxDim - 1u) / maxDim;
        let x = (count + y - 1u) / y;
        dispatchArgs[0] = x;
        dispatchArgs[1] = y;
    }
    dispatchArgs[2] = 1u;
}
`;
