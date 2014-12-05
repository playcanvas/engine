    float accumLifePrev = max(totalTimePrev + startSpawnTime + particleRate, 0.0);
    bool respawn = floor(accumLife / (particleLifetime + particleRate)) != floor(accumLifePrev / (particleLifetime + particleRate));

    if (!respawn) {
        vec3 moveDir = particleVelocity * stretch;
        vec3 posPrev = pos - moveDir;
        posPrev += particlePosMoved;

        vec2 velocityV = normalize((mat3(matrix_view) * particleVelocity).xy);
        vec2 centerToVertexV = normalize((mat3(matrix_view) * localPos).xy);

        float interpolation = dot(-velocityV, centerToVertexV) * 0.5 + 0.5;

        particlePos = mix(particlePos, posPrev, interpolation);
    }

