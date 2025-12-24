export default /* glsl */`
    if (outLife >= lifetime) {
        outLife -= max(lifetime, numParticles * particleRate);
        visMode = 1.0;
    }
    visMode = outLife < 0.0? 1.0: visMode;
`;
