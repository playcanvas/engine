export default /* wgsl */`
    var orderTexture: texture_2d<u32>;
    var sourceTexture: texture_2d<f32>;
    uniform numSplats: u32;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        let w: u32 = textureDimensions(sourceTexture, 0).x;
        let idx: u32 = u32(pcPosition.x) + u32(pcPosition.y) * w;
        if (idx >= uniform.numSplats) {
            discard;
            return output;
        }

        // fetch the source index and calculate source uv
        let sidx: u32 = textureLoad(orderTexture, vec2<i32>(input.position.xy), 0).x;
        let suv: vec2<u32> = vec2<u32>(sidx % w, sidx / w);

        // sample the source texture
        output.color = textureLoad(sourceTexture, vec2<i32>(suv), 0);
        return output;
    }
`;
