attribute aPosition: vec3f;
attribute aUv0: vec2f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;

varying vUv0: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.vUv0 = input.aUv0;
    output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(input.aPosition, 1.0);
    return output;
}

