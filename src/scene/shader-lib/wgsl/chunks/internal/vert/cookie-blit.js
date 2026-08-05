export default /* wgsl */`
    attribute vertex_position: vec2f;
    varying uv0: vec2f;

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(input.vertex_position, 0.5, 1.0);
        output.uv0 = input.vertex_position * 0.5 + vec2f(0.5, 0.5);
        output.uv0.y = 1.0 - output.uv0.y;
        return output;
    }
`;
