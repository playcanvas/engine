attribute vertex_position: vec4f;
attribute vertex_normal: vec3f;
attribute vertex_texCoord0: vec2f;

uniform matrix_model: mat4x4f;
uniform matrix_view: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform matrix_normal: mat3x3f;

varying texCoord: vec2f;
varying viewNormal: vec3f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    output.position = uniform.matrix_viewProjection * uniform.matrix_model * vertex_position;
    output.texCoord = vertex_texCoord0;

    // the normal in the view space, which bends the view through the glass
    output.viewNormal = (uniform.matrix_view * vec4f(uniform.matrix_normal * vertex_normal, 0.0)).xyz;
    return output;
}
