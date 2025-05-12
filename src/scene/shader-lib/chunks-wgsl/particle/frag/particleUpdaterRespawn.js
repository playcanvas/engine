export default /* wgsl */`
    if (outLife >= uniform.lifetime) {
        let subtractAmount = max(uniform.lifetime, (uniform.numParticles - 1.0) * particleRate);
        outLife = outLife - subtractAmount;
        visMode = 1.0;
    }
    visMode = select(visMode, 1.0, outLife < 0.0);
`;
