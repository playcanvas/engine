    if (life >= particleLifetime) {
        life -= max(particleLifetime, (numParticles - 1.0) * particleRate);
        visMode = 1.0;
    }
    visMode = life < 0.0? 1.0: visMode;

