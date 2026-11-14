attribute vec4 vertex_position;
attribute vec3 vertex_normal;
attribute vec2 vertex_texCoord0;

uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_viewProjection;
uniform mat3 matrix_normal;

varying vec2 texCoord;
varying vec3 viewNormal;

void main(void)
{
    gl_Position = matrix_viewProjection * matrix_model * vertex_position;
    texCoord = vertex_texCoord0;

    // the normal in the view space, which bends the view through the glass
    viewNormal = (matrix_view * vec4(matrix_normal * vertex_normal, 0.0)).xyz;
}
