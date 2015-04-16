uniform float spawnBoundsSphere;
vec3 calcSpawnPosition(vec3 inBounds, float rndFactor) {
    float rnd4 = fract(rndFactor * 1000.0);
    return emitterPos + normalize(inBounds.xyz - vec3(0.5)) * rnd4 * spawnBoundsSphere;
}

void addInitialVelocity(inout vec3 localVelocity, vec3 inBounds) {
    localVelocity += normalize(inBounds - vec3(0.5)) * initialVelocity;
}

