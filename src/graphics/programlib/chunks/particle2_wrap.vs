
    vec3 origParticlePos = particlePos;
    particlePos -= matrix_viewInverse[3].xyz;
    //vec3 volume = vec3(10.0, 5.0, 10.0);
    particlePos = mod(particlePos, wrapBounds*2.0) - wrapBounds;
    particlePos += matrix_viewInverse[3].xyz;
    particlePosMoved = particlePos - origParticlePos;


