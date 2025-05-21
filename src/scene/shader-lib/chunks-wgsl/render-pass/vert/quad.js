// A simple vertex shader used to render a quad, which requires 'vec2 aPosition' in the vertex
// buffer, and generates uv coordinates uv0 for use in the fragment shader.
export default /* wgsl */`
    attribute aPosition: vec2f;
    varying uv0: vec2f;
    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(input.aPosition, 0.0, 1.0);
        output.uv0 = getImageEffectUV((input.aPosition + 1.0) * 0.5);
        return output;
    }
`;
