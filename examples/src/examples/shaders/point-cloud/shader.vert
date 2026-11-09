
// Attributes per vertex: position
attribute vec4 aPosition;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;

// time
uniform float uTime;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    // Transform the geometry
    mat4 modelViewProj = matrix_viewProjection * matrix_model;
    gl_Position = modelViewProj * aPosition;

    // vertex in world space
    vec4 vertexWorld = matrix_model * aPosition;

    // use sine way to generate intensity value based on time and also y-coordinate of model
    float intensity = abs(sin(0.6 * vertexWorld.y + uTime * 1.0));

    // intensity smoothly drops to zero for smaller values than 0.9
    intensity = smoothstep(0.9, 1.0, intensity);

    // point size depends on intensity
    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0
    #ifndef WEBGPU
        gl_PointSize = clamp(12.0 * intensity, 1.0, 64.0);
    #endif

    // color mixes red and yellow based on intensity
    outColor = mix(vec4(1.0, 1.0, 0.0, 1.0), vec4(0.9, 0.0, 0.0, 1.0), intensity);
}