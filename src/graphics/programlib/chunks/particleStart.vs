// VERTEX SHADER INPUTS: ATTRIBUTES
attribute vec4 particle_uvLifeTimeFrameStart; // uv, lifeTime, frameStart
attribute vec4 particle_positionStartTime;    // position.xyz, startTime
attribute vec4 particle_velocityStartSize;    // velocity.xyz, startSize
attribute vec4 particle_accelerationEndSize;  // acceleration.xyz, endSize
attribute vec4 particle_spinStartSpinSpeed;   // spinStart.x, spinSpeed.y
attribute vec4 particle_colorMult;            // multiplies color and ramp textures

// VERTEX SHADER INPUTS: UNIFORMS
uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat4 matrix_viewInverse;
uniform vec3 particle_worldVelocity;
uniform vec3 particle_worldAcceleration;
uniform float particle_timeRange;
uniform float particle_time;
uniform float particle_timeOffset;
uniform float particle_frameDuration;
uniform float particle_numFrames;

// VERTEX SHADER OUTPUTS
varying vec2 vUv0;
varying float vAge;
varying vec4 vColor;

