export default /* wgsl */`
attribute vertex_position: vec3f;
uniform projectionFlipY: f32;
varying steadyUV: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4f(vertex_position.xy * vec2f(1.0, uniform.projectionFlipY), 0.0, 1.0);
    output.steadyUV = vertex_position.xy * vec2f(0.5, -0.5) + 0.5;
    return output;
}
`;
