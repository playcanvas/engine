attribute aPosition: vec4f;
attribute aUv0: vec2f;
attribute aNormal: vec3f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform matrix_normal: mat3x3f;

varying vUv0: vec2f;
varying worldNormal: vec3f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    output.vUv0 = aUv0;
    output.worldNormal = normalize(uniform.matrix_normal * aNormal);
    output.position = uniform.matrix_viewProjection * uniform.matrix_model * aPosition;

    return output;
}