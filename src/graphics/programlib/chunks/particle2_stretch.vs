    float accumLifePrev = max(totalTimePrev + startSpawnTime + particleRate, 0.0);
    bool respawn = floor(accumLife / (particleLifetime + particleRate)) != floor(accumLifePrev / (particleLifetime + particleRate));

    if (!respawn) {
        particleTex = texture2D(particleTexIN, vec2(id / numParticlesPot, 0.0));
        vec3 posPrev = particleTex.xyz;
        vec3 moveDir = (pos - posPrev) * stretch;
        posPrev = pos - moveDir;
        posPrev += particlePosMoved;

        float interpolation =  quadXY.y * 0.5 + 0.5;
        particlePos = mix(particlePos, posPrev, interpolation);
    }

