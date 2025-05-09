export default /* glsl */`
varying vec2 vUv0;

uniform highp sampler2D particleTexIN;
uniform highp sampler2D internalTex0;
uniform highp sampler2D internalTex1;
uniform highp sampler2D internalTex2;
uniform highp sampler2D internalTex3;

uniform mat3 emitterMatrix;
uniform mat3 emitterMatrixInv;
uniform vec3 emitterScale;

uniform vec3 emitterPos;
uniform vec3 frameRandom;
uniform vec3 localVelocityDivMult;
uniform vec3 velocityDivMult;
uniform float delta;
uniform float rate;
uniform float rateDiv;
uniform float lifetime;
uniform float numParticles;
uniform float rotSpeedDivMult;
uniform float radialSpeedDivMult;
uniform float seed;
uniform float startAngle;
uniform float startAngle2;
uniform float initialVelocity;

uniform float graphSampleSize;
uniform float graphNumSamples;

vec3 inPos;
vec3 inVel;
float inAngle;
bool inShow;
float inLife;
float visMode;

vec3 outPos;
vec3 outVel;
float outAngle;
bool outShow;
float outLife;
`;
