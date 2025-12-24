export default /* wgsl */`
uniform spawnBoundsSphere: f32;
uniform spawnBoundsSphereInnerRatio: f32;

fn calcSpawnPosition(inBounds: vec3f, rndFactor: f32) -> vec3f {
    let rnd4: f32 = fract(rndFactor * 1000.0);
    let norm: vec3f = normalize(inBounds.xyz - vec3f(0.5));
    let r: f32 = rnd4 * (1.0 - uniform.spawnBoundsSphereInnerRatio) + uniform.spawnBoundsSphereInnerRatio;

    #ifndef LOCAL_SPACE
        return uniform.emitterPos + norm * r * uniform.spawnBoundsSphere;
    #else
        return norm * r * uniform.spawnBoundsSphere;
    #endif
}

fn addInitialVelocity(localVelocity: ptr<function, vec3f>, inBounds: vec3f) {
    let initialVelOffset: vec3f = normalize(inBounds - vec3f(0.5)) * uniform.initialVelocity;
    *localVelocity = *localVelocity + initialVelOffset;
}
`;
