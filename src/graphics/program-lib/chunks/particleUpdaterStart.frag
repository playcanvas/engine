float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec3 unpack3NFloats(float src) {
    float r = fract(src);
    float g = fract(src * 256.0);
    float b = fract(src * 65536.0);
    return vec3(r, g, b);
}

vec3 tex1Dlod_lerp(sampler2D tex, vec2 tc, out vec3 w) {
    vec4 a = texture2D(tex, tc);
    vec4 b = texture2D(tex, tc + graphSampleSize);
    float c = fract(tc.x * graphNumSamples);

    vec3 unpackedA = unpack3NFloats(a.w);
    vec3 unpackedB = unpack3NFloats(b.w);
    w = mix(unpackedA, unpackedB, c);

    return mix(a.xyz, b.xyz, c);
}

#define W0 0.5545497
#define W1 0.308517
// as is this will start to show defects outside of
// the interval [-2048, 2048]
float hash(in vec2 c)
{
  float x = c.x*fract(c.x * W0);
  float y = c.y*fract(c.y * W1);

  // NOTICE: as is - if a sampling an integer lattice
  // any zero input will cause a black line in that
  // direction.
  return fract(x*y);
}


void main(void)
{
    if (gl_FragCoord.x > numParticles) discard;

    readInput();
    visMode = inShow? 1.0 : -1.0;

    float rndFactorx = hash(gl_FragCoord.xx + vec2(100.0 + seed));
    float rndFactory = hash(gl_FragCoord.xx + vec2(200.0 + seed));
    float rndFactorz = hash(gl_FragCoord.xx + vec2(300.0 + seed));
    float rndFactorw = hash(gl_FragCoord.xx + vec2(400.0 + seed));
    vec4 rndFactor = vec4(rndFactorx, rndFactory, rndFactorz, rndFactorw);

    float particleRate = rate + rateDiv * rndFactor.x;

    outLife = inLife + delta;
    float nlife = clamp(outLife / lifetime, 0.0, 1.0);

    vec3 localVelocityDiv;
    vec3 velocityDiv;
    vec3 paramDiv;
    vec3 localVelocity = tex1Dlod_lerp(internalTex0, vec2(nlife, 0), localVelocityDiv);
    vec3 velocity =      tex1Dlod_lerp(internalTex1, vec2(nlife, 0), velocityDiv);
    vec3 params =        tex1Dlod_lerp(internalTex2, vec2(nlife, 0), paramDiv);
    float rotSpeed = params.x;
    float rotSpeedDiv = paramDiv.y;

    localVelocity +=    (localVelocityDiv * vec3(2.0) - vec3(1.0)) * localVelocityDivMult * rndFactor.xyz;
    velocity +=         (velocityDiv * vec3(2.0) - vec3(1.0)) * velocityDivMult * rndFactor.xyz;
    rotSpeed +=         (rotSpeedDiv * 2.0 - 1.0) * rotSpeedDivMult * rndFactor.y;

    addInitialVelocity(localVelocity, rndFactor.xyz);


    outVel = emitterMatrix * localVelocity.xyz + velocity.xyz * emitterScale;
    outPos = inPos + outVel * delta;
    outAngle = inAngle + rotSpeed * delta;

    bool respawn = outLife <= 0.0 || outLife >= lifetime;
    outPos = respawn? calcSpawnPosition(rndFactor.xyz, rndFactor.x) : outPos;
    outAngle = respawn? mix(startAngle, startAngle2, rndFactor.x) : outAngle;
    outVel = respawn? vec3(0.0) : outVel;


