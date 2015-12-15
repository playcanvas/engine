attribute vec4 particle_vertexData;     // XYZ = world pos, W = life
attribute vec4 particle_vertexData2;     // X = angle, Y = scale, Z = alpha, W = velocity.x
attribute vec4 particle_vertexData3;     // XYZ = particle local pos, W = velocity.y
attribute vec2 particle_vertexData4;     // X = velocity.z, W = particle ID

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat3 matrix_normal;
uniform mat4 matrix_viewInverse;

uniform float numParticles;
uniform float lifetime;
uniform float stretch;
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
    vec3 pos = particlePos;
    vec3 vertPos = particle_vertexData3.xyz;
    vec3 particleVelocity = vec3(particle_vertexData2.w, particle_vertexData3.w, particle_vertexData4.x);
    vec2 velocityV = normalize((mat3(matrix_view) * particleVelocity).xy); // should be removed by compiler if align/stretch is not used

    vec2 quadXY = vertPos.xy;
    texCoordsAlphaLife = vec4(quadXY * -0.5 + 0.5, particle_vertexData2.z, particle_vertexData.w);

    mat2 rotMatrix;
    mat3 localMat;

    float angle = particle_vertexData2.x;
    vec3 particlePosMoved = vec3(0.0);
    vec3 meshLocalPos = particle_vertexData3.xyz;

