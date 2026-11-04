// The rectangle of the panel on the screen, in normalized device coordinates: the bottom left
// corner, followed by the top right corner
uniform panelRect: vec4f;

varying uv: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    // the corner of the quad, from the index of the vertex: (0, 0), (1, 0), (0, 1) and (1, 1)
    let corner = vec2f(f32(input.vertexIndex & 1u), f32(input.vertexIndex >> 1u));

    var output: VertexOutput;
    output.position = vec4f(mix(uniform.panelRect.xy, uniform.panelRect.zw, corner), 0.0, 1.0);
    output.uv = corner;
    return output;
}
