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
uniform float rate, rateDiv, lifetime, deltaRandomnessStatic, scaleDivMult, alphaDivMult, seed;
uniform sampler2D particleTexOUT, particleTexIN;
uniform sampler2D internalTex0;
uniform sampler2D internalTex1;
uniform sampler2D internalTex2;

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

void main(void) {
    vec3 meshLocalPos = particle_vertexData.xyz;
    float id = floor(particle_vertexData.w);

    float rndFactor = fract(sin(id + 1.0 + seed));
    vec3 rndFactor3 = vec3(rndFactor, fract(rndFactor*10.0), fract(rndFactor*100.0));

    vec4 particleTex = texture2D(particleTexOUT, vec2(id / numParticlesPot, 0.125));
    vec3 pos = particleTex.xyz;
    float angle = (particleTex.w < 0.0? -particleTex.w : particleTex.w) - 1000.0;
    bool hide = particleTex.w < 0.0;

    vec4 particleTex2 = texture2D(particleTexOUT, vec2(id / numParticlesPot, 0.375));
    vec3 particleVelocity = particleTex2.xyz;
    vec2 velocityV = normalize((mat3(matrix_view) * particleVelocity).xy); // should be removed by compiler if align/stretch is not used
    float life = particleTex2.w;

    float particleLifetime = lifetime;

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


