// Attributes per vertex: position
attribute vec4 aPosition;
attribute vec4 aColor;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;

// Color to fragment program
varying vec4 outColor;

void main(void)
{
    mat4 modelViewProj = matrix_viewProjection * matrix_model;
    gl_Position = modelViewProj * aPosition;

    // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0
    #ifndef WEBGPU
        gl_PointSize = 1.5;
    #endif

    outColor = aColor;
}
