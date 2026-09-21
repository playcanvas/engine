export default /* glsl */`
    if (outLife >= lifetime) {
        visMode = 1.0;
    }
    outLife = respawnLife(floor(gl_FragCoord.x), particleRate, outLife);
    visMode = outLife < 0.0? 1.0: visMode;
`;
