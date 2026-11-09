
// A vertex shader for image elements on a screen-space screen, which pass one UV set through.
// There, matrix_model already maps the element straight to clip space, so the camera's matrices
// are not needed. An element on a world-space screen would use matrix_viewProjection as well.

uniform mat4 matrix_model;

attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;

varying vec2 vUv0;

void main(void) {
    vUv0 = vertex_texCoord0;
    gl_Position = matrix_model * vec4(vertex_position, 1.0);
    gl_Position.zw = vec2(0.0, 1.0);
}
