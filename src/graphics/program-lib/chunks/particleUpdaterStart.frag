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

vec2 encodeFloatRG( float v ) {
  vec2 enc = vec2(1.0, 255.0) * v;
  enc = fract(enc);
  enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);
  return enc;
}

float decodeFloatRG(vec2 rg) {
    return rg.x + rg.y/255.0;
}

vec4 encodeFloatRGBA( float v ) {
  vec4 enc = vec4(1.0, 255.0, 65025.0, 160581375.0) * v;
  enc = fract(enc);
  enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
  return enc;
}

float decodeFloatRGBA( vec4 rgba ) {
  return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );
}


void main(void)
{
    if (gl_FragCoord.x > numParticles) discard;

    //vec4 tex = texture2D(particleTexIN, vec2(vUv0.x, 0.25));
    //vec4 tex2 = texture2D(particleTexIN, vec2(vUv0.x, 0.75));
    //vec3 inPos = tex.xyz;
    //inPos = (inPos - vec3(0.5)) * prevBoundsSize + prevBoundsCenter;
    //float angle = (tex.w < 0.0? -tex.w : tex.w) - 1000.0;
    //float visMode = tex.w < 0.0? -1.0 : 1.0;
    //float storedLife = tex2.w;
    //float outMask0 = gl_FragCoord.y < 1.0? 1.0 : 0.0;
    //float outMask1 = (gl_FragCoord.y < 2.0 && gl_FragCoord.y >= 1.0)? 1.0 : 0.0;
    //float outMask2 = (gl_FragCoord.y < 3.0 && gl_FragCoord.y >= 2.0)? 1.0 : 0.0;

    vec4 tex0 = texture2D(particleTexIN, vec2(vUv0.x, 0.125));
    vec4 tex1 = texture2D(particleTexIN, vec2(vUv0.x, 0.375));
    vec4 tex2 = texture2D(particleTexIN, vec2(vUv0.x, 0.625));
    vec4 tex3 = texture2D(particleTexIN, vec2(vUv0.x, 0.875));
    vec3 inPos = vec3(decodeFloatRG(tex0.rg), decodeFloatRG(tex0.ba), decodeFloatRG(tex1.rg));
    inPos = (inPos - vec3(0.5)) * prevBoundsSize + prevBoundsCenter;
    float angle = decodeFloatRG(tex1.ba) * 2000.0 - 1000.0;
    float visMode = tex2.a * 2.0 - 1.0;
    float storedLife = decodeFloatRGBA(tex3);
    float outMask0 = gl_FragCoord.y < 1.0? 1.0 : 0.0;
    float outMask1 = (gl_FragCoord.y < 2.0 && gl_FragCoord.y >= 1.0)? 1.0 : 0.0;
    float outMask2 = (gl_FragCoord.y < 3.0 && gl_FragCoord.y >= 2.0)? 1.0 : 0.0;
    float outMask3 = (gl_FragCoord.y < 4.0 && gl_FragCoord.y >= 3.0)? 1.0 : 0.0;


    float rndFactorx = hash(gl_FragCoord.xx + vec2(100.0 + seed));
    float rndFactory = hash(gl_FragCoord.xx + vec2(200.0 + seed));
    float rndFactorz = hash(gl_FragCoord.xx + vec2(300.0 + seed));
    float rndFactorw = hash(gl_FragCoord.xx + vec2(400.0 + seed));
    vec4 rndFactor = vec4(rndFactorx, rndFactory, rndFactorz, rndFactorw);

    float particleLifetime = lifetime;
    float particleRate = rate + rateDiv * rndFactor.x;

    float maxNegLife = max(particleLifetime, (numParticles - 1.0) * (rate+rateDiv));
    float maxPosLife = particleLifetime+1.0;
    storedLife = storedLife * (maxNegLife + maxPosLife) - maxNegLife;

    float life = storedLife + delta;

        float nlife = clamp(life / particleLifetime, 0.0, 1.0);
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


        vec3 outVelocity = emitterMatrix * localVelocity.xyz + velocity.xyz * emitterScale;
        vec3 outPosition = inPos + outVelocity * delta;
        float outRotation = angle + rotSpeed * delta;

        bool respawn = life <= 0.0 || life >= particleLifetime;
        outPosition = respawn? calcSpawnPosition(rndFactor.xyz, rndFactor.x) : outPosition;
        outRotation = respawn? mix(startAngle, startAngle2, rndFactor.x) : outRotation;
        outVelocity = respawn? vec3(0.0) : outVelocity;
