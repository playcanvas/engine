// PCG RXS-M-XS: https://www.jcgt.org/published/0009/03/02/.
export default /* wgsl */`
fn steadyPrimitivePhase(id: u32) -> u32 {
    let state = id * 747796405u + 2891336453u;
    let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

fn steadyNoiseThreshold(rank: u32, phase: u32, period: u32) -> f32 {
    let rotated = (rank << 24u) + phase + period;
    return f32(rotated >> 8u) * (1.0 / 16777216.0);
}
`;
