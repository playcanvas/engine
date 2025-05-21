export default /* glsl */`
    attribute vec4 vertex_position;
    attribute vec4 vertex_color;
    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;
    varying vec4 color;
    void main(void) {
        color = vertex_color;
        gl_Position = matrix_viewProjection * matrix_model * vertex_position;
    }
`;
