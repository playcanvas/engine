export default /* glsl */`
    if (outLife >= lifetime) {
        visMode = -1.0;
    }
    outLife = respawnLife(floor(gl_FragCoord.x), particleRate, outLife);
`;
