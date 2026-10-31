attribute vertex_position: vec4f;
attribute vertex_texCoord0: vec2f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;

varying texCoord: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let pos: vec4f = uniform.matrix_model * vertex_position;
    output.position = uniform.matrix_viewProjection * pos;

    output.texCoord = vertex_texCoord0;
    return output;
}