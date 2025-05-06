export default /* wgsl */`
    if (outLife >= uniform.lifetime) {
        outLife = outLife - max(uniform.lifetime, (uniform.numParticles - 1.0) * particleRate);
        visMode = -1.0;
    }
`;
