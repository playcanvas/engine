attribute vec4 aPosition;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

void main(void)
{
    gl_Position = matrix_viewProjection * matrix_model * aPosition;
}
