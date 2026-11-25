// Attributes per vertex: position
attribute aPosition: vec4f;

uniform matrix_viewProjection: mat4x4f;
uniform matrix_model: mat4x4f;

// Color to fragment program
varying outColor: vec4f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Transform the geometry
    let modelViewProj: mat4x4f = uniform.matrix_viewProjection * uniform.matrix_model;
    output.position = modelViewProj * aPosition;

    // vertex in world space
    let vertexWorld: vec4f = uniform.matrix_model * aPosition;

    // WebGPU only supports a point size of 1, so the point size is not set

    // color depends on position of particle
    output.outColor = vec4f(vertexWorld.y * 0.1, 0.1, vertexWorld.z * 0.1, 1.0);
    return output;
}
