// Sums the histograms of the rows of the meter into the histogram of the whole screen, four bins
// per texel, which is read back to the CPU.
export default /* wgsl */`
    var aeRowsTexture: texture_2d<u32>;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        let column = i32(pcPosition.x);
        var counts = vec4u(0u);
        for (var row = 0; row < {AE_METER_HEIGHT}; row++) {
            counts += textureLoad(aeRowsTexture, vec2i(column, row), 0);
        }

        output.color = counts;
        return output;
    }
`;
