attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

varying vec2 texCoord;

void main(void)
{
    // project the position
    vec4 pos = matrix_model * vec4(vertex_position, 1.0);
    gl_Position = matrix_viewProjection * pos;

    texCoord = vertex_texCoord0;
}
