export default /* glsl */`

attribute vec4 instance_line1;
attribute vec4 instance_line2;
attribute vec4 instance_line3;
attribute vec4 instance_line4;

mat4 getModelMatrix() {
    return matrix_model * mat4(instance_line1, instance_line2, instance_line3, instance_line4);
}
`;
