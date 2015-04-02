uniform mat3 spawnBounds;
vec3 calcSpawnPosition(vec3 inBounds, float rndFactor) {
    return emitterPos + spawnBounds * (inBounds - vec3(0.5));
}

void addInitialVelocity(inout vec3 localVelocity, vec3 inBounds) {
    localVelocity -= vec3(0, 0, initialVelocity);
}

