attribute vec4 particle_vertexData; // XYZ = particle position, W = particle ID + random factor
#ifdef USE_MESH
attribute vec2 particle_uv;         // mesh UV
#endif

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat3 matrix_normal;
uniform mat4 matrix_viewInverse;

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

uniform float numParticles, numParticlesPot;
uniform float graphSampleSize;
uniform float graphNumSamples;
uniform float stretch;
uniform vec3 wrapBounds;
uniform vec3 emitterScale, emitterPos, faceTangent, faceBinorm;
uniform float rate, rateDiv, lifetime, deltaRandomnessStatic, scaleDivMult, alphaDivMult, seed, delta;
uniform sampler2D particleTexOUT, particleTexIN;
uniform sampler2D internalTex0;
uniform sampler2D internalTex1;
uniform sampler2D internalTex2;

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

