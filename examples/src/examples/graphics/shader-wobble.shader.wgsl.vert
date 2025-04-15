attribute aPosition: vec3f;
attribute aUv0: vec2f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uTime: f32;

varying vUv0: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    var pos: vec4f = uniform.matrix_model * vec4f(input.aPosition, 1.0);
    pos.x = pos.x + sin(uniform.uTime + pos.y * 4.0) * 0.1;
    pos.y = pos.y + cos(uniform.uTime + pos.x * 4.0) * 0.1;
    output.vUv0 = input.aUv0;
    output.position = uniform.matrix_viewProjection * pos;
    return output;
}