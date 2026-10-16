// Blends the lighting of the dynamic sky effect from its previous update to its latest one, see the
// GLSL version.
export default /* wgsl */`
    var dynSkyBlendPrevious: texture_2d<f32>;
    var dynSkyBlendLatest: texture_2d<f32>;
    uniform dynSkyBlendWeight: f32;

    #include "decodePS"
    #include "encodePS"

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let texel = vec2i(pcPosition.xy);
        let previous = decodeRGBP(textureLoad(dynSkyBlendPrevious, texel, 0));
        let latest = decodeRGBP(textureLoad(dynSkyBlendLatest, texel, 0));
        output.color = encodeRGBP(mix(previous, latest, vec3f(uniform.dynSkyBlendWeight)));
        return output;
    }
`;
