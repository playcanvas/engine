// Compute 2D dispatch dimensions from a linear workgroup count, staying within the
// per-dimension limit. Mirrors Compute.calcDispatchSize on the CPU side.
export default /* wgsl */`
fn calcDispatch2D(count: u32, maxDim: u32) -> vec2u {
    if (count <= maxDim) {
        return vec2u(count, 1u);
    }
    let y = (count + maxDim - 1u) / maxDim;
    let x = (count + y - 1u) / y;
    return vec2u(x, y);
}
`;
