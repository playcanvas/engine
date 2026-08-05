export default /* wgsl */`
uniform spawnBounds: mat3x3f;
uniform spawnPosInnerRatio: vec3f;

fn calcSpawnPosition(inBounds: vec3f, rndFactor: f32) -> vec3f {
    var pos = inBounds - vec3f(0.5);

    let posAbs = abs(pos);
    let maxComp = max(posAbs.x, max(posAbs.y, posAbs.z));
    let maxPos = vec3f(maxComp);

    let edge = maxPos + (vec3f(0.5) - maxPos) * uniform.spawnPosInnerRatio;

    pos.x = edge.x * select(2.0 * pos.x, sign(pos.x), maxPos.x == posAbs.x);
    pos.y = edge.y * select(2.0 * pos.y, sign(pos.y), maxPos.y == posAbs.y);
    pos.z = edge.z * select(2.0 * pos.z, sign(pos.z), maxPos.z == posAbs.z);

    #ifndef LOCAL_SPACE
        return uniform.emitterPos + uniform.spawnBounds * pos;
    #else
        return uniform.spawnBounds * pos;
    #endif
}

fn addInitialVelocity(localVelocity: ptr<function, vec3f>, inBounds: vec3f) {
    *localVelocity = *localVelocity - vec3f(0.0, 0.0, uniform.initialVelocity);
}
`;
