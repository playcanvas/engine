    life = life >= particleLifetime? (particleLifetime + particleRate * gl_FragCoord.x) : life;

