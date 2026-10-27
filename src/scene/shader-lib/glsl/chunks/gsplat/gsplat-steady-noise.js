// PCG RXS-M-XS: https://www.jcgt.org/published/0009/03/02/.
export default /* glsl */`
uint steadyPrimitivePhase(uint id) {
    uint state = id * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

float steadyNoiseThreshold(uint rank, uint phase, uint period) {
    uint rotated = (rank << 24u) + phase + period;
    return float(rotated >> 8u) * (1.0 / 16777216.0);
}
`;
