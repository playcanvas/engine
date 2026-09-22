export default /* glsl */`
float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec3 unpack3NFloats(float src) {
    float r = fract(src);
    float g = fract(src * 256.0);
    float b = fract(src * 65536.0);
    return vec3(r, g, b);
}

vec3 tex1Dlod_lerp(TEXTURE_ACCEPT_HIGHP(tex), vec2 tc, out vec3 w) {
    vec4 a = texture2D(tex, tc);
    vec4 b = texture2D(tex, tc + graphSampleSize);
    float c = fract(tc.x * graphNumSamples);

    vec3 unpackedA = unpack3NFloats(a.w);
    vec3 unpackedB = unpack3NFloats(b.w);
    w = mix(unpackedA, unpackedB, c);

    return mix(a.xyz, b.xyz, c);
}

// The life a particle carries on with - negative while it waits its turn to be born.
//
// At the end of its life a particle waits for its own slot in the emission cycle, so that a rate
// which has just changed re-spreads the particles over the new period rather than keeping the
// spacing of the old one. That applies only when rate2 matches rate: with a randomized rate every
// particle has a period of its own, so the phases decorrelate by themselves, and forcing an even
// grid would undo the randomization that was asked for.
//
// On the step a rate change lands, a particle already queued for longer than the new rate allows
// is released at its slot, so that raising the rate takes effect at once instead of after the whole
// of the old period. The emitter-wide period is used there, being the longest any particle can
// wait, so a particle that is legitimately still waiting is never released early.
float respawnLife(float particleId, float particleRate, float life) {
    if (life >= lifetime) {
        float period = max(lifetime, numParticles * particleRate);

        // an emitter at capacity has no slack to spread over, and its particles are alive
        // continuously whatever their phase, so keep the wait exactly as it was
        if (rateDiv != 0.0 || (period - lifetime) * numParticles < period) return life - period;

        return -mod(particleId * period / numParticles - emissionTime, period);
    }

    if (rateChanged > 0.0) {
        float maxPeriod = max(lifetime, numParticles * (rate + max(rateDiv, 0.0)));
        if (life < lifetime - maxPeriod) {
            return max(life, -mod(particleId * maxPeriod / numParticles - emissionTime, maxPeriod));
        }
    }

    return life;
}

#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)
vec4 hash41(float p) {
    vec4 p4 = fract(vec4(p) * HASHSCALE4);
    p4 += dot(p4, p4.wzxy+19.19);
    return fract(vec4((p4.x + p4.y)*p4.z, (p4.x + p4.z)*p4.y, (p4.y + p4.z)*p4.w, (p4.z + p4.w)*p4.x));
}

void main(void) {
    if (gl_FragCoord.x > numParticles) discard;

    readInput(vUv0.x);
    visMode = inShow? 1.0 : -1.0;

    vec4 rndFactor = hash41(gl_FragCoord.x + seed);

    float particleRate = rate + rateDiv * rndFactor.x;

    outLife = inLife + delta;
    float nlife = clamp(outLife / lifetime, 0.0, 1.0);

    vec3 localVelocityDiv;
    vec3 velocityDiv;
    vec3 paramDiv;
    vec3 localVelocity = tex1Dlod_lerp(TEXTURE_PASS(internalTex0), vec2(nlife, 0), localVelocityDiv);
    vec3 velocity =      tex1Dlod_lerp(TEXTURE_PASS(internalTex1), vec2(nlife, 0), velocityDiv);
    vec3 params =        tex1Dlod_lerp(TEXTURE_PASS(internalTex2), vec2(nlife, 0), paramDiv);
    float rotSpeed = params.x;
    float rotSpeedDiv = paramDiv.y;

    vec3 radialParams = tex1Dlod_lerp(TEXTURE_PASS(internalTex3), vec2(nlife, 0), paramDiv);
    float radialSpeed = radialParams.x;
    float radialSpeedDiv = radialParams.y;

    bool respawn = inLife <= 0.0 || outLife >= lifetime;
    inPos = respawn ? calcSpawnPosition(rndFactor.xyz, rndFactor.x) : inPos;
    inAngle = respawn ? mix(startAngle, startAngle2, rndFactor.x) : inAngle;

#ifndef LOCAL_SPACE
    vec3 radialVel = inPos - emitterPos;
#else
    vec3 radialVel = inPos;
#endif
    radialVel = (dot(radialVel, radialVel) > 1.0E-8) ? radialSpeed * normalize(radialVel) : vec3(0.0);
    radialVel += (radialSpeedDiv * vec3(2.0) - vec3(1.0)) * radialSpeedDivMult * rndFactor.xyz;

    localVelocity +=    (localVelocityDiv * vec3(2.0) - vec3(1.0)) * localVelocityDivMult * rndFactor.xyz;
    velocity +=         (velocityDiv * vec3(2.0) - vec3(1.0)) * velocityDivMult * rndFactor.xyz;
    rotSpeed +=         (rotSpeedDiv * 2.0 - 1.0) * rotSpeedDivMult * rndFactor.y;

    addInitialVelocity(localVelocity, rndFactor.xyz);

#ifndef LOCAL_SPACE
    outVel = emitterMatrix * localVelocity + (radialVel + velocity) * emitterScale;
#else
    outVel = (localVelocity + radialVel) / emitterScale + emitterMatrixInv * velocity;
#endif

    outPos = inPos + outVel * delta;
    outAngle = inAngle + rotSpeed * delta;
`;
