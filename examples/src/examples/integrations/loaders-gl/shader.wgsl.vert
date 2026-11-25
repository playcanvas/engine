// Attributes per vertex: position
attribute aPosition: vec4f;
attribute aColor: vec4f;

uniform matrix_viewProjection: mat4x4f;
uniform matrix_model: mat4x4f;

// Color to fragment program
varying outColor: vec4f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let modelViewProj: mat4x4f = uniform.matrix_viewProjection * uniform.matrix_model;
    output.position = modelViewProj * aPosition;

    // WebGPU only supports a point size of 1, so the point size is not set

    output.outColor = aColor;
    return output;
}
