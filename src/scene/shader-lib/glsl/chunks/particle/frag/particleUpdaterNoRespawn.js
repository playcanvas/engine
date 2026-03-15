export default /* glsl */`
    if (outLife >= lifetime) {
        outLife -= max(lifetime, numParticles * particleRate);
        visMode = -1.0;
    }
`;
