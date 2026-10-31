
// A vertex shader for image elements on a screen-space screen, which pass one UV set through.
// There, matrix_model already maps the element straight to clip space, so the camera's matrices
// are not needed. An element on a world-space screen would use matrix_viewProjection as well.

uniform matrix_model: mat4x4f;

attribute vertex_position: vec3f;
attribute vertex_texCoord0: vec2f;

varying vUv0: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.vUv0 = input.vertex_texCoord0;
    let position = uniform.matrix_model * vec4f(input.vertex_position, 1.0);
    output.position = vec4f(position.xy, 0.0, 1.0);
    return output;
}
