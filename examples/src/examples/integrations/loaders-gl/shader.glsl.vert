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

    gl_PointSize = 1.5;

    outColor = aColor;
}
