// Shades a lens flare element with its shape, read from the layer of the shape texture array the
// element uses, tinted by the colour its vertex shader resolved. The result is added to the flare
// texture.
export default /* wgsl */`
    var lensFlareShapes: texture_2d_array<f32>;
    var lensFlareShapesSampler: sampler;

    varying vUv0: vec2f;
    varying vColor: vec3f;
    varying vLayer: f32;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let shape = textureSample(lensFlareShapes, lensFlareShapesSampler, getImageEffectUV(vUv0), i32(vLayer + 0.5));

        // undo the square root encoding of the baked shape
        let value = shape.rgb * shape.rgb * shape.a;
        output.color = vec4f(value * vColor, 1.0);
        return output;
    }
`;
