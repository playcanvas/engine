
    vec3 origParticlePos = particlePos;
    particlePos -= matrix_model[3].xyz;
    particlePos = mod(particlePos, wrapBounds) - wrapBounds * 0.5;
    particlePos += matrix_model[3].xyz;
    particlePosMoved = particlePos - origParticlePos;


