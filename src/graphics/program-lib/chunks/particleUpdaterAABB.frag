uniform mat3 spawnBounds;
uniform vec3 spawnPosInnerRatio;
vec3 calcSpawnPosition(vec3 inBounds, float rndFactor) {
    vec3 pos = inBounds - vec3(0.5);
    return emitterPos + spawnBounds * ((vec3(1.0) - spawnPosInnerRatio) * pos + 0.5 * spawnPosInnerRatio * sign(pos));
}

void addInitialVelocity(inout vec3 localVelocity, vec3 inBounds) {
    localVelocity -= vec3(0, 0, initialVelocity);
}

