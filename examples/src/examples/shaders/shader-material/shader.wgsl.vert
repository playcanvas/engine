attribute aPosition: vec3f;
attribute aUv0: vec2f;

varying fragPosition: vec4f;
varying texCoord: vec2f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let localPos = vec4f(input.aPosition, 1.0);
    output.position = uniform.matrix_viewProjection * (uniform.matrix_model * localPos);
    output.fragPosition = 0.5 * (localPos + vec4f(1.0));
    output.texCoord = input.aUv0;
    return output;
}
