attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

void main(void)
{
    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);;
}
