    life = life < 0.0? (particleLifetime + particleRate * gl_FragCoord.x) : life;

