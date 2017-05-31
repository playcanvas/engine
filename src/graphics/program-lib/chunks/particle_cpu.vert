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
uniform vec3 emitterPos;

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

vec3 billboard(vec3 InstanceCoords, vec2 quadXY)
{
    vec3 pos = -matrix_viewInverse[0].xyz * quadXY.x + -matrix_viewInverse[1].xyz * quadXY.y;
    return pos;
}


void main(void)
{
    vec3 particlePos = particle_vertexData.xyz;
    vec3 inPos = particlePos;
    vec3 vertPos = particle_vertexData3.xyz;
    vec3 inVel = vec3(particle_vertexData2.w, particle_vertexData3.w, particle_vertexData4.x);
    vec2 velocityV = normalize((mat3(matrix_view) * inVel).xy); // should be removed by compiler if align/stretch is not used

    vec2 quadXY = vertPos.xy;
    texCoordsAlphaLife = vec4(quadXY * -0.5 + 0.5, particle_vertexData2.z, particle_vertexData.w);

    mat2 rotMatrix;

    float inAngle = particle_vertexData2.x;
    vec3 particlePosMoved = vec3(0.0);
    vec3 meshLocalPos = particle_vertexData3.xyz;

