// Copies one lens flare shape texture into a layer of the shape texture array, at the resolution
// of the array. The shape is stored with a square root encoding, which keeps precision in its dark
// tail and which the sprite shader squares back.
export default /* wgsl */`
    var lensFlareShapeImage: texture_2d<f32>;
    var lensFlareShapeImageSampler: sampler;

    varying uv0: vec2f;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let image = textureSample(lensFlareShapeImage, lensFlareShapeImageSampler, uv0);
        output.color = vec4f(sqrt(clamp(image.rgb, vec3f(0.0), vec3f(1.0))), image.a);
        return output;
    }
`;
