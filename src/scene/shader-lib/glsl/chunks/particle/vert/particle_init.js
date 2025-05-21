export default /* glsl */`
attribute vec4 particle_vertexData; // XYZ = particle position, W = particle ID + random factor

#if defined(USE_MESH)
    #if defined(USE_MESH_UV)
        attribute vec2 particle_uv;         // mesh UV
    #else
        vec2 particle_uv = vec2(0.0, 0.0);
    #endif
#endif

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat3 matrix_normal;
uniform mat4 matrix_viewInverse;

#ifndef VIEWMATRIX
    #define VIEWMATRIX
    uniform mat4 matrix_view;
#endif

uniform float numParticles;
uniform float numParticlesPot;
uniform float graphSampleSize;
uniform float graphNumSamples;
uniform float stretch;
uniform vec3 wrapBounds;
uniform vec3 emitterScale;
uniform vec3 emitterPos;
uniform vec3 faceTangent;
uniform vec3 faceBinorm;
uniform float rate;
uniform float rateDiv;
uniform float lifetime;
uniform float deltaRandomnessStatic;
uniform float scaleDivMult;
uniform float alphaDivMult;
uniform float seed;
uniform float delta;
uniform sampler2D particleTexOUT;
uniform sampler2D particleTexIN;

#ifdef PARTICLE_GPU
    uniform highp sampler2D internalTex0;
    uniform highp sampler2D internalTex1;
    uniform highp sampler2D internalTex2;
#endif

#ifndef CAMERAPLANES
    #define CAMERAPLANES
    uniform vec4 camera_params;
#endif

varying vec4 texCoordsAlphaLife;

vec3 inPos;
vec3 inVel;
float inAngle;
bool inShow;
float inLife;
`;
