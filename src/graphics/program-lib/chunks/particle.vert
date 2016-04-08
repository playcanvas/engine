attribute vec4 particle_vertexData; // XYZ = particle position, W = particle ID + random factor

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat3 matrix_normal;
uniform mat4 matrix_viewInverse;
uniform mat4 matrix_view;

uniform float numParticles, numParticlesPot;
uniform float graphSampleSize;
uniform float graphNumSamples;
uniform float stretch;
uniform vec3 wrapBounds;
uniform vec3 emitterScale;
uniform float rate, rateDiv, lifetime, deltaRandomnessStatic, scaleDivMult, alphaDivMult, seed, delta;
uniform sampler2D particleTexOUT, particleTexIN;
uniform sampler2D internalTex0;
uniform sampler2D internalTex1;
uniform sampler2D internalTex2;

uniform vec3 boundsSize;
uniform vec3 boundsCenter;

uniform vec3 prevBoundsSize;
uniform vec3 prevBoundsCenter;

uniform float maxVel;

varying vec4 texCoordsAlphaLife;

vec3 unpack3NFloats(float src) {
    float r = fract(src);
    float g = fract(src * 256.0);
    float b = fract(src * 65536.0);
    return vec3(r, g, b);
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec4 tex1Dlod_lerp(sampler2D tex, vec2 tc) {
    return mix( texture2D(tex,tc), texture2D(tex,tc + graphSampleSize), fract(tc.x*graphNumSamples) );
}

vec4 tex1Dlod_lerp(sampler2D tex, vec2 tc, out vec3 w) {
    vec4 a = texture2D(tex,tc);
    vec4 b = texture2D(tex,tc + graphSampleSize);
    float c = fract(tc.x*graphNumSamples);

    vec3 unpackedA = unpack3NFloats(a.w);
    vec3 unpackedB = unpack3NFloats(b.w);
    w = mix(unpackedA, unpackedB, c);

    return mix(a, b, c);
}


vec2 rotate(vec2 quadXY, float pRotation, out mat2 rotMatrix) {
    float c = cos(pRotation);
    float s = sin(pRotation);

    mat2 m = mat2(c, -s, s, c);
    rotMatrix = m;

    return m * quadXY;
}

vec3 billboard(vec3 InstanceCoords, vec2 quadXY, out mat3 localMat) {
    vec3 viewUp = matrix_viewInverse[1].xyz;
    vec3 posCam = matrix_viewInverse[3].xyz;

    mat3 billMat;
    billMat[2] = normalize(InstanceCoords - posCam);
    billMat[0] = normalize(cross(viewUp, billMat[2]));
    billMat[1] = -viewUp;
    vec3 pos = billMat * vec3(quadXY, 0);

    localMat = billMat;

    return pos;
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

float decodeFloatRG(vec2 rg) {
    return rg.x + rg.y/255.0;
}

float decodeFloatRGBA( vec4 rgba ) {
  return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );
}


void main(void) {
    vec3 meshLocalPos = particle_vertexData.xyz;
    float id = floor(particle_vertexData.w);

    float rndFactor = fract(sin(id + 1.0 + seed));
    vec3 rndFactor3 = vec3(rndFactor, fract(rndFactor*10.0), fract(rndFactor*100.0));

    //vec4 particleTex = texture2D(particleTexOUT, vec2(id / numParticlesPot, 0.25));
    //vec4 particleTex2 = texture2D(particleTexOUT, vec2(id / numParticlesPot, 0.75));
    //vec3 pos = particleTex.xyz;
    //pos = (pos - vec3(0.5)) * boundsSize + boundsCenter;
    //float angle = (particleTex.w < 0.0? -particleTex.w : particleTex.w) - 1000.0;
    //bool hide = particleTex.w < 0.0;
    //vec3 particleVelocity = particleTex2.xyz;
    //float life = particleTex2.w;
    //particleVelocity = (particleVelocity - vec3(0.5)) * maxVel;

    float uv = id / numParticlesPot;
    vec4 tex0 = texture2D(particleTexOUT, vec2(uv, 0.125));
    vec4 tex1 = texture2D(particleTexOUT, vec2(uv, 0.375));
    vec4 tex2 = texture2D(particleTexOUT, vec2(uv, 0.625));
    vec4 tex3 = texture2D(particleTexOUT, vec2(uv, 0.875));
    vec3 pos = vec3(decodeFloatRG(tex0.rg), decodeFloatRG(tex0.ba), decodeFloatRG(tex1.rg));
    pos = (pos - vec3(0.5)) * boundsSize + boundsCenter;
    float angle = decodeFloatRG(tex1.ba) * 2000.0 - 1000.0;
    bool hide = tex2.a < 0.5;
    float life = decodeFloatRGBA(tex3);
    vec3 particleVelocity = tex2.xyz;
    particleVelocity = (particleVelocity - vec3(0.5)) * maxVel;


    vec2 velocityV = normalize((mat3(matrix_view) * particleVelocity).xy); // should be removed by compiler if align/stretch is not used
    float particleLifetime = lifetime;

    float maxNegLife = max(particleLifetime, (numParticles - 1.0) * (rate+rateDiv));
    float maxPosLife = particleLifetime+1.0;
    life = life * (maxNegLife + maxPosLife) - maxNegLife;

    if (life <= 0.0 || life > particleLifetime || hide) meshLocalPos = vec3(0.0);
    vec2 quadXY = meshLocalPos.xy;
    float nlife = clamp(life / particleLifetime, 0.0, 1.0);

    vec3 paramDiv;
    vec4 params = tex1Dlod_lerp(internalTex2, vec2(nlife, 0), paramDiv);
    float scale = params.y;
    float scaleDiv = paramDiv.x;
    float alphaDiv = paramDiv.z;

    scale += (scaleDiv * 2.0 - 1.0) * scaleDivMult * fract(rndFactor*10000.0);

    texCoordsAlphaLife = vec4(quadXY * -0.5 + 0.5,    (alphaDiv * 2.0 - 1.0) * alphaDivMult * fract(rndFactor*1000.0),    nlife);

    vec3 particlePos = pos;
    vec3 particlePosMoved = vec3(0.0);

    mat2 rotMatrix;
    mat3 localMat;


