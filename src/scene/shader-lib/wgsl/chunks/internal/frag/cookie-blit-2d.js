export default /* wgsl */`
    varying uv0: vec2f;

    var blitTexture: texture_2d<f32>;
    var blitTextureSampler : sampler;

    @fragment
    fn fragmentMain(input : FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        output.color = textureSample(blitTexture, blitTextureSampler, input.uv0);
        return output;
    }
`;
