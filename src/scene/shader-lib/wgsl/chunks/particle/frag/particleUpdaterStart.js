export default /* wgsl */`
fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn unpack3NFloats(src: f32) -> vec3f {
    let r = fract(src);
    let g = fract(src * 256.0);
    let b = fract(src * 65536.0);
    return vec3f(r, g, b);
}

// Struct to handle multiple return values from tex1Dlod_lerp
struct TexLerpUnpackResult {
    result: vec3f,
    unpacked: vec3f
}

fn tex1Dlod_lerp(tex: texture_2d<f32>, textureSize: vec2u, tc: vec2f) -> TexLerpUnpackResult {
    let tc_next = tc + vec2f(uniform.graphSampleSize);
    let texelA: vec2i = vec2i(tc * vec2f(textureSize));
    let texelB: vec2i = vec2i(tc_next * vec2f(textureSize));
    let a = textureLoad(tex, texelA, 0);
    let b = textureLoad(tex, texelB, 0);
    let c = fract(tc.x * uniform.graphNumSamples);

    let unpackedA = unpack3NFloats(a.w);
    let unpackedB = unpack3NFloats(b.w);
    let w_out = mix(unpackedA, unpackedB, c);

    return TexLerpUnpackResult(mix(a.xyz, b.xyz, c), w_out);
}

const HASHSCALE4: vec4f = vec4f(1031.0, 0.1030, 0.0973, 0.1099);
fn hash41(p: f32) -> vec4f {
    var p4 = fract(vec4f(p) * HASHSCALE4);
    p4 = p4 + dot(p4, p4.wzxy + 19.19);
    return fract(vec4f((p4.x + p4.y)*p4.z, (p4.x + p4.z)*p4.y, (p4.y + p4.z)*p4.w, (p4.z + p4.w)*p4.x));
}

@fragment
fn fragmentMain(input : FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    if (pcPosition.x > uniform.numParticles) {
        discard;
        return output;
    }

    readInput(input.vUv0.x);
    visMode = select(-1.0, 1.0, inShow);

    let rndFactor = hash41(pcPosition.x + uniform.seed);

    let particleRate = uniform.rate + uniform.rateDiv * rndFactor.x;

    outLife = inLife + uniform.delta;
    let nlife = clamp(outLife / uniform.lifetime, 0.0, 1.0);

    let internalTexSize = textureDimensions(internalTex0, 0);

    let lerpResult0 = tex1Dlod_lerp(internalTex0, internalTexSize, vec2f(nlife, 0.0));
    var localVelocity = lerpResult0.result;
    let localVelocityDiv = lerpResult0.unpacked;

    let lerpResult1 = tex1Dlod_lerp(internalTex1, internalTexSize, vec2f(nlife, 0.0));
    var velocity = lerpResult1.result;
    let velocityDiv = lerpResult1.unpacked;

    let lerpResult2 = tex1Dlod_lerp(internalTex2, internalTexSize, vec2f(nlife, 0.0));
    let params = lerpResult2.result;
    let paramDiv = lerpResult2.unpacked;
    var rotSpeed = params.x;
    let rotSpeedDiv = paramDiv.y;

    let lerpResult3 = tex1Dlod_lerp(internalTex3, internalTexSize, vec2f(nlife, 0.0));
    let radialParams = lerpResult3.result;
    let radialParamDiv = lerpResult3.unpacked;
    let radialSpeed = radialParams.x;
    let radialSpeedDiv = radialParamDiv.y;

    let respawn = inLife <= 0.0 || outLife >= uniform.lifetime;
    inPos = select(inPos, calcSpawnPosition(rndFactor.xyz, rndFactor.x), respawn);
    inAngle = select(inAngle, mix(uniform.startAngle, uniform.startAngle2, rndFactor.x), respawn);

    #ifndef LOCAL_SPACE
        var radialVel: vec3f = inPos - uniform.emitterPos;
    #else
        var radialVel: vec3f = inPos;
    #endif
    radialVel = select(vec3f(0.0), radialSpeed * normalize(radialVel), dot(radialVel, radialVel) > 1.0E-8);
    radialVel = radialVel + (radialSpeedDiv * vec3f(2.0) - vec3f(1.0)) * uniform.radialSpeedDivMult * rndFactor.xyz;

    localVelocity = localVelocity + (localVelocityDiv * vec3f(2.0) - vec3f(1.0)) * uniform.localVelocityDivMult * rndFactor.xyz;
    velocity = velocity + (velocityDiv * vec3f(2.0) - vec3f(1.0)) * uniform.velocityDivMult * rndFactor.xyz;
    rotSpeed = rotSpeed + (rotSpeedDiv * 2.0 - 1.0) * uniform.rotSpeedDivMult * rndFactor.y;

    addInitialVelocity(&localVelocity, rndFactor.xyz);

    #ifndef LOCAL_SPACE
        outVel = uniform.emitterMatrix * localVelocity + (radialVel + velocity) * uniform.emitterScale;
    #else
        outVel = (localVelocity + radialVel) / uniform.emitterScale + uniform.emitterMatrixInv * velocity;
    #endif

    outPos = inPos + outVel * uniform.delta;
    outAngle = inAngle + rotSpeed * uniform.delta;
`;
