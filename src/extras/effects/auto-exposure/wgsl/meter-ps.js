// Averages the scene into the meter, a small fixed size grid. Each texel of the meter is the average
// of the whole block of scene texels it covers - the blocks of neighbouring texels meet without a
// gap or an overlap, so a small bright light counts once wherever it is, rather than flickering in
// and out between samples as the camera moves. Each texel stores the brightness of its block, as
// its position along the range of the histogram in 16 bits, see FramePassLuminanceHistogram.
export default /* wgsl */`
    var aeSourceTexture: texture_2d<f32>;
    var aeSourceTextureSampler: sampler;

    // the size of the source texture in texels
    uniform aeSourceSize: vec2f;

    // the log2 luminance at the start of the range of the histogram, and the reciprocal of its size
    uniform aeRange: vec2f;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // the block of source texels this texel of the meter covers
        let meterSize = vec2i({AE_METER_WIDTH}, {AE_METER_HEIGHT});
        let sourceSize = vec2i(uniform.aeSourceSize);
        let texel = vec2i(pcPosition.xy);
        let start = texel * sourceSize / meterSize;
        let end = max((texel + 1) * sourceSize / meterSize, start + 1);

        // sampled two by two texels, between the four, where the bilinear filter weights them
        // equally - or between two, or at one, at the edges of a block of an odd size
        var sum = vec3f(0.0);
        var count = 0.0;
        for (var y = start.y; y < end.y; y += 2) {
            let h = min(2, end.y - y);
            for (var x = start.x; x < end.x; x += 2) {
                let w = min(2, end.x - x);
                let uv = (vec2f(f32(x), f32(y)) + vec2f(f32(w), f32(h)) * 0.5) / uniform.aeSourceSize;
                let n = f32(w * h);
                sum += textureSampleLevel(aeSourceTexture, aeSourceTextureSampler, uv, 0.0).rgb * n;
                count += n;
            }
        }

        // the position in 16 bits, the high and the low byte in the red and the green channel
        let luminance = dot(sum / count, vec3f(0.2126, 0.7152, 0.0722));
        let position = clamp((log2(max(luminance, 1.0e-10)) - uniform.aeRange.x) * uniform.aeRange.y, 0.0, 1.0);
        let value = floor(position * 65535.0 + 0.5);
        let high = floor(value / 256.0);
        output.color = vec4f(high, value - high * 256.0, 0.0, 255.0) / 255.0;
        return output;
    }
`;
