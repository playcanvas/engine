attribute vec4 particle_vertexData;     // XYZ = world pos, W = life
attribute vec4 particle_vertexData2;     // X = angle, Y = scale, Z = alpha, W = unused
attribute vec4 particle_vertexData3;     // XYZ = particle local pos

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat3 matrix_normal;
uniform mat4 matrix_viewInverse;

uniform float numParticles;
uniform float lifetime;
//uniform float graphSampleSize;
//uniform float graphNumSamples;
uniform vec3 wrapBounds, emitterScale;
uniform sampler2D texLifeAndSourcePosOUT;
uniform sampler2D internalTex0;
uniform sampler2D internalTex1;
uniform sampler2D internalTex2;

varying vec4 texCoordsAlphaLife;


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
    vec3 particlePos = particle_vertexData.xyz;
    vec3 vertPos = particle_vertexData3.xyz;

    //float vfrac = fract(particle_vertexData2.w);
    vec2 TC = vertPos.xy*0.5+0.5;//vec2(particle_vertexData2.w - vfrac, vfrac*10.0);

    texCoordsAlphaLife = vec4(TC, particle_vertexData2.z, particle_vertexData.w);

    vec2 quadXY = TC*2.0 - 1.0;

    mat2 rotMatrix;
    mat3 localMat;

    quadXY = rotate(quadXY, particle_vertexData2.x, rotMatrix);
    //quadXY *= particle_vertexData2.y;

    vec3 localPos = billboard(particlePos, quadXY, localMat);
    vec3 particlePosMoved = vec3(0.0);



