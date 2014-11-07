
    vec3 origParticlePos = particlePos;
    particlePos -= matrix_viewInverse[3].xyz;
    particlePos = mod(particlePos, wrapBounds*2.0) - wrapBounds;
    particlePos += matrix_viewInverse[3].xyz;
    particlePosMoved = particlePos - origParticlePos;


