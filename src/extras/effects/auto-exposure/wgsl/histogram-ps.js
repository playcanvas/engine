// Counts the texels of one row of the meter into four bins of the histogram - the fragment at
// (i, row) counts bins 4i to 4i + 3 of that row. Rather than scattering each texel into its bin with
// blending, every fragment gathers the texels of its row, so the counts are exact without needing
// a blendable integer or float target. Each texel adds itself to its two nearest bins, weighted by
// its distance to them, so the histogram changes gradually as a texel moves between bins, and by
// the metering weight of its position on the screen. The counts are in 16.16 fixed point.
export default /* wgsl */`
    var aeMeterTexture: texture_2d<f32>;

    // how much the metering favors the center of the screen, 0-1
    uniform aeCenterWeight: f32;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        let fragment = vec2i(pcPosition.xy);
        let row = fragment.y;
        let bins = vec4f(f32(fragment.x * 4)) + vec4f(0.0, 1.0, 2.0, 3.0);

        // the metering weight of the texels of the row, by their distance to the center
        let v = (f32(row) + 0.5) / f32({AE_METER_HEIGHT}) - 0.5;

        var counts = vec4u(0u);
        for (var x = 0; x < {AE_METER_WIDTH}; x++) {
            let bytes = floor(textureLoad(aeMeterTexture, vec2i(x, row), 0).rg * 255.0 + 0.5);
            let position = (bytes.r * 256.0 + bytes.g) / 65535.0 * f32({AE_BINS} - 1);
            let u = (f32(x) + 0.5) / f32({AE_METER_WIDTH}) - 0.5;
            let weight = mix(1.0, exp(-8.0 * (u * u + v * v)), uniform.aeCenterWeight);
            let share = max(vec4f(0.0), 1.0 - abs(bins - position)) * weight;
            counts += vec4u(share * 65536.0 + 0.5);
        }

        output.color = counts;
        return output;
    }
`;
