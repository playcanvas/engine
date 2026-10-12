// A vertex shader rendering a quad covering the projected screen space bounds of a local light
// volume, used by the volumetric fog local lights pass. Note that the generated uv0 addresses the
// full render target, and not just the quad, so the fragment shader can sample screen space
// textures with it.
export default /* wgsl */`
    attribute aPosition: vec2f;

    // normalized device coordinates of the light volume bounds: xy = min, zw = max
    uniform uVolLightRect: vec4f;

    varying uv0: vec2f;

    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        let ndc: vec2f = mix(uniform.uVolLightRect.xy, uniform.uVolLightRect.zw, input.aPosition * 0.5 + 0.5);
        output.position = vec4f(ndc, 0.0, 1.0);
        output.uv0 = getImageEffectUV(ndc * 0.5 + 0.5);
        return output;
    }
`;
