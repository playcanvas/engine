    vec3 moveDir = inVel * stretch;
    vec3 posPrev = particlePos - moveDir;
    posPrev += particlePosMoved;

    vec2 centerToVertexV = normalize((mat3(matrix_view) * localPos).xy);

    float interpolation = dot(-velocityV, centerToVertexV) * 0.5 + 0.5;

    particlePos = mix(particlePos, posPrev, interpolation);

