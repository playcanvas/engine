export default /* wgsl */`
    // not the fastest way, but easier to plug in; TODO: create rot matrix right from vectors
    inAngle = atan2(velocityV.x, velocityV.y);
`;
