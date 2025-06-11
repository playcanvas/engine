attribute position: vec4f;
attribute texCoords: vec2f;

varying fragPosition: vec4f;
varying texCoord: vec2f;

uniform matrix_model : mat4x4f;
uniform matrix_viewProjection : mat4x4f;

@vertex
fn vertexMain(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = uniform.matrix_viewProjection * (uniform.matrix_model * input.position);
    output.fragPosition = 0.5 * (input.position + vec4(1.0));
    output.texCoord = input.texCoords;
    return output;
}
