uniform mat3 spawnBounds;
uniform vec3 spawnPosInnerRatio;
vec3 calcSpawnPosition(vec3 inBounds, float rndFactor) {
    vec3 pos = inBounds - vec3(0.5);

    vec3 posAbs = abs(pos);
    vec3 maxPos = vec3(max(posAbs.x, max(posAbs.y, posAbs.z)));

    vec3 edge = maxPos + (vec3(0.5) - maxPos) * spawnPosInnerRatio;

    //pos = edge * mix(2.0 * pos, sign(pos), equal(maxPos, posAbs));
    pos.x = edge.x * (maxPos.x == posAbs.x ? sign(pos.x) : 2.0 * pos.x);
    pos.y = edge.y * (maxPos.y == posAbs.y ? sign(pos.y) : 2.0 * pos.y);
    pos.z = edge.z * (maxPos.z == posAbs.z ? sign(pos.z) : 2.0 * pos.z);

#ifndef LOCAL_SPACE
    return emitterPos + spawnBounds * pos;
#else
    return spawnBounds * pos;
#endif
}

void addInitialVelocity(inout vec3 localVelocity, vec3 inBounds) {
    localVelocity -= vec3(0, 0, initialVelocity);
}

