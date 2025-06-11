// fragment shader internally used to apply morph targets in textures into a final texture containing
// blended morph targets
export default /* wgsl */`

    varying uv0: vec2f;

    var morphTexture: texture_2d_array<f32>;
    var morphTextureSampler : sampler;
    uniform morphFactor: array<f32, {MORPH_TEXTURE_MAX_COUNT}>;
    uniform morphIndex: array<u32, {MORPH_TEXTURE_MAX_COUNT}>;
    uniform count: u32;

    @fragment
    fn fragmentMain(input : FragmentInput) -> FragmentOutput {
        var color = vec3f(0, 0, 0);
        for (var i: u32 = 0; i < uniform.count; i = i + 1) {
            var textureIndex: u32 = uniform.morphIndex[i].element;
            var delta = textureSample(morphTexture, morphTextureSampler, input.uv0, textureIndex).xyz;
            color += uniform.morphFactor[i].element * delta;
        }

        var output: FragmentOutput;
        output.color = vec4f(color, 1.0);
        return output;
    }
`;
