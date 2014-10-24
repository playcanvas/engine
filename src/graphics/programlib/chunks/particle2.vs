attribute vec4 particle_vertexData; // XYZ = particle position, W = particle ID + random factor

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat3 matrix_normal;
uniform mat4 matrix_viewInverse;
uniform mat4 matrix_view;

uniform float numParticles;
uniform float lifetime;
uniform float graphSampleSize;
uniform float graphNumSamples;
uniform float stretch;
uniform vec3 wrapBounds;
uniform sampler2D texLifeAndSourcePosOUT;
uniform sampler2D internalTex0;
uniform sampler2D internalTex1;
uniform sampler2D internalTex2;

//uniform sampler2D texPos;
//uniform sampler2D texRot;
//uniform sampler2D texPosRnd;

varying vec4 TexCoordsAlphaLife;


vec3 unpack3NFloats(float src)
{
    float r = fract(src);
    float g = fract(src * 256.0);
    float b = fract(src * 65536.0);
    return vec3(r, g, b);
}

vec4 tex1Dlod_lerp(sampler2D tex, vec2 tc)
{
    return mix( texture2D(tex,tc), texture2D(tex,tc + graphSampleSize), fract(tc.x*graphNumSamples) );
}

vec4 tex1Dlod_lerp(sampler2D tex, vec2 tc, out vec3 w)
{
    vec4 a = texture2D(tex,tc);
    vec4 b = texture2D(tex,tc + graphSampleSize);
    float c = fract(tc.x*graphNumSamples);

    vec3 unpackedA = unpack3NFloats(a.w);
    vec3 unpackedB = unpack3NFloats(b.w);
    w = mix(unpackedA, unpackedB, c);

    return mix(a, b, c);
}


vec2 rotate(vec2 quadXY, float pRotation, out mat2 rotMatrix)
{
    float c = cos(pRotation);
    float s = sin(pRotation);
    //vec4 rotationMatrix = vec4(c, -s, s, c);

    mat2 m = mat2(c, -s, s, c);
    rotMatrix = m;

    return m * quadXY;
}

vec3 billboard(vec3 InstanceCoords, vec2 quadXY, out mat3 localMat)
{
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


void main(void)
{
    vec2 quadXY = particle_vertexData.xy;
    float id = floor(particle_vertexData.w);
    float rndFactor = fract(particle_vertexData.w);
    vec3 rndFactor3 = vec3(rndFactor, fract(rndFactor*10.0), fract(rndFactor*100.0));

    vec4 lifeAndSourcePos = texture2D(texLifeAndSourcePosOUT, vec2(id/numParticles, 0.0));
    vec3 sourcePos = lifeAndSourcePos.xyz;
    float life = max(lifeAndSourcePos.w, 0.0) / lifetime;

    if (lifeAndSourcePos.w < 0.0) quadXY = vec2(0,0);

    vec3 paramDivergence;
    vec3 localOffset =     tex1Dlod_lerp(internalTex0, vec2(life, 0), paramDivergence).xyz;
    float scaleRnd = paramDivergence.x;
    float angleRnd = paramDivergence.y;
    float alphaRnd = paramDivergence.z;

    vec3 posDivergence;
    vec3 worldOffset =    tex1Dlod_lerp(internalTex1, vec2(life, 0), posDivergence).xyz;

    vec3 posWorldDivergence;
    vec4 rot =                 tex1Dlod_lerp(internalTex2, vec2(life, 0), posWorldDivergence);
    float angle = rot.x;
    float scale = rot.y;

    vec3 divergentLocalOffset =     mix(localOffset.xyz, -localOffset.xyz, rndFactor3);
    localOffset.xyz =                     mix(localOffset.xyz, divergentLocalOffset, posDivergence);

    vec3 divergentWorldOffset =     mix(worldOffset.xyz, -worldOffset.xyz, rndFactor3);
    worldOffset.xyz =                     mix(worldOffset.xyz, divergentWorldOffset, posWorldDivergence);

    angle = mix(angle, -angle, rndFactor * angleRnd);
    scale = mix(scale, scale*rndFactor, scaleRnd);

    TexCoordsAlphaLife = vec4(quadXY*0.5+0.5,    alphaRnd * (fract(rndFactor*1000.0) * 2.0 - 1.0),    life);

    vec3 particlePos = sourcePos + matrix_normal * localOffset.xyz   +   worldOffset.xyz;
    vec3 particlePosMoved = vec3(0.0);

    mat2 rotMatrix;
    mat3 localMat;


