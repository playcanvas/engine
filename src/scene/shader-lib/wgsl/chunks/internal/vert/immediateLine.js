export default /* wgsl */`
    attribute vertex_position: vec4f;
    attribute vertex_color: vec4f;
    uniform matrix_model: mat4x4f;
    uniform matrix_viewProjection: mat4x4f;
    varying color: vec4f;
    @vertex
    fn vertexMain(input : VertexInput) -> VertexOutput {
        var output : VertexOutput;
        output.color = input.vertex_color;
        output.position = uniform.matrix_viewProjection * uniform.matrix_model * input.vertex_position;
        return output;
    }
`;
