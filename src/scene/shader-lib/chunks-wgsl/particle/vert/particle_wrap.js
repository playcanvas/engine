export default /* wgsl */`
    let origParticlePos: vec3f = particlePos;
    particlePos = particlePos - uniform.matrix_model[3].xyz;
    particlePos = (particlePos % uniform.wrapBounds) - uniform.wrapBounds * 0.5;
    particlePos = particlePos + uniform.matrix_model[3].xyz;
    particlePosMoved = particlePos - origParticlePos;
`;
