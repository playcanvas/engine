export default /* wgsl */`
    varying uv0: vec2f;
    uniform invViewProj: mat4x4<f32>;
    var blitTexture: texture_cube<f32>;
    var blitTextureSampler : sampler;

    @fragment
    fn fragmentMain(input : FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        var projPos = vec4f(input.uv0 * 2.0 - 1.0, 0.5, 1.0);
        var worldPos = uniform.invViewProj * projPos;
        output.color = textureSample(blitTexture, blitTextureSampler, worldPos.xyz);
        return output;
    }
`;
