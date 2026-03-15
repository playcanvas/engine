attribute aPosition: vec4f;
attribute aUv0: vec2f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;

varying vUv0: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.vUv0 = aUv0;
    output.position = uniform.matrix_viewProjection * uniform.matrix_model * aPosition;
    return output;
}