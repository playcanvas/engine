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

void main(void)
{
    if (gl_FragCoord.x > numParticles) discard;
    float outMask0 = gl_FragCoord.y < 1.0? 1.0 : 0.0;
    float outMask1 = (gl_FragCoord.y < 2.0 && gl_FragCoord.y >= 1.0)? 1.0 : 0.0;
    float outMask2 = (gl_FragCoord.y < 3.0 && gl_FragCoord.y >= 2.0)? 1.0 : 0.0;

    vec4 tex = texture2D(particleTexIN, vec2(vUv0.x, 0.125));
    vec4 tex2 = texture2D(particleTexIN, vec2(vUv0.x, 0.375));
    vec4 texR = texture2D(particleTexIN, vec2(vUv0.x, 0.625));

    vec4 rndFactor = fract(texR + vec4(seed));
    float particleLifetime = lifetime;
    float life = tex2.w + delta;
    float particleRate = rate + rateDiv * rndFactor.x;

        float nlife = clamp(life / particleLifetime, 0.0, 1.0);
        vec3 localVelocityDiv;
        vec3 velocityDiv;
        vec3 paramDiv;
        vec3 localVelocity = tex1Dlod_lerp(internalTex0, vec2(nlife, 0), localVelocityDiv);
        vec3 velocity =      tex1Dlod_lerp(internalTex1, vec2(nlife, 0), velocityDiv);
        vec3 params =        tex1Dlod_lerp(internalTex2, vec2(nlife, 0), paramDiv);
        float rotSpeed = params.x;
        float rotSpeedDiv = paramDiv.y;
        float angle = (tex.w < 0.0? -tex.w : tex.w) - 1000.0;
        float visMode = tex.w < 0.0? -1.0 : 1.0;

        localVelocity +=    (localVelocityDiv * vec3(2.0) - vec3(1.0)) * localVelocityDivMult * rndFactor.xyz;
        velocity +=         (velocityDiv * vec3(2.0) - vec3(1.0)) * velocityDivMult * rndFactor.zxy;
        rotSpeed +=         (rotSpeedDiv * 2.0 - 1.0) * rotSpeedDivMult * rndFactor.y;

        addInitialVelocity(localVelocity, rndFactor.xyz);

        vec3 outVelocity = emitterMatrix * localVelocity.xyz + velocity.xyz * emitterScale;
        vec3 outPosition = tex.xyz + outVelocity * delta;
        float outRotation = angle + rotSpeed * delta;

        bool respawn = life <= 0.0 || life >= particleLifetime;
        outPosition = respawn? calcSpawnPosition(rndFactor.xyz, rndFactor.x) : outPosition;
        outRotation = respawn? mix(startAngle, startAngle2, rndFactor.x) : outRotation;
        outVelocity = respawn? vec3(0.0) : outVelocity;
