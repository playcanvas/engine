// Attributes per vertex: position
attribute aPosition: vec4f;

uniform matrix_viewProjection: mat4x4f;
uniform matrix_model: mat4x4f;

// time
uniform uTime: f32;

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

    // use sine way to generate intensity value based on time and also y-coordinate of model
    var intensity: f32 = abs(sin(0.6 * vertexWorld.y + uniform.uTime * 1.0));

    // intensity smoothly drops to zero for smaller values than 0.9
    intensity = smoothstep(0.9, 1.0, intensity);

    // WebGPU only supports a point size of 1, so the point size is not set

    // color mixes red and yellow based on intensity
    output.outColor = mix(vec4f(1.0, 1.0, 0.0, 1.0), vec4f(0.9, 0.0, 0.0, 1.0), intensity);
    return output;
}
