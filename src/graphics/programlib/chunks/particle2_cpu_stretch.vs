    vec2 velocityV = normalize(vec2(particle_vertexData2.w, particle_vertexData3.w));
    vec2 centerToVertexV = normalize((mat3(matrix_view) * localPos).xy);
    vec3 particleVelocityUnprojected = vec3(particle_vertexData2.w, particle_vertexData3.w, 0.0) * mat3(matrix_view);
    vec3 moveDir = particleVelocityUnprojected * stretch;
    vec3 posPrev = particlePos - moveDir;
    float interpolation = dot(-velocityV, centerToVertexV) * 0.5 + 0.5;
    particlePos = mix(particlePos, posPrev, interpolation);

