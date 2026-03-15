export default /* wgsl */`

attribute instance_line1: vec4f;
attribute instance_line2: vec4f;
attribute instance_line3: vec4f;
attribute instance_line4: vec4f;

fn getModelMatrix() -> mat4x4f {
    return uniform.matrix_model * mat4x4f(instance_line1, instance_line2, instance_line3, instance_line4);
}
`;
