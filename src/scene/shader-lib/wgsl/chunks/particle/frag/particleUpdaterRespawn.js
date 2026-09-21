export default /* wgsl */`
    if (outLife >= uniform.lifetime) {
        visMode = 1.0;
    }
    outLife = respawnLife(floor(pcPosition.x), particleRate, outLife);
    visMode = select(visMode, 1.0, outLife < 0.0);
`;
