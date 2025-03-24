// fragment shader internally used to apply morph targets in textures into a final texture containing
// blended morph targets
export default /* wgsl */`

    varying uv0: vec2f;

    // LOOP - source morph target textures
    #include "morphDeclarationPS, MORPH_TEXTURE_COUNT"

    #if MORPH_TEXTURE_COUNT > 0
        uniform morphFactor: array<f32, {MORPH_TEXTURE_COUNT}>;
    #endif

    @fragment
    fn fragmentMain(input : FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        var color = vec3f(0, 0, 0);

        // LOOP - source morph target textures
        #include "morphEvaluationPS, MORPH_TEXTURE_COUNT"

        output.color = vec4f(color, 1.0);
        return output;
    }
`;
