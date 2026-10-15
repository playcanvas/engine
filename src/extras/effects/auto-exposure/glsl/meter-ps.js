// Averages the scene into the meter, a small fixed size grid. Each texel of the meter is the average
// of the whole block of scene texels it covers - the blocks of neighbouring texels meet without a
// gap or an overlap, so a small bright light counts once wherever it is, rather than flickering in
// and out between samples as the camera moves. Each texel stores the brightness of its block, as
// its position along the range of the histogram in 16 bits, see FramePassLuminanceHistogram.
export default /* glsl */`
    uniform sampler2D aeSourceTexture;

    // the size of the source texture in texels
    uniform vec2 aeSourceSize;

    // the log2 luminance at the start of the range of the histogram, and the reciprocal of its size
    uniform vec2 aeRange;

    void main() {

        // the block of source texels this texel of the meter covers
        ivec2 meterSize = ivec2({AE_METER_WIDTH}, {AE_METER_HEIGHT});
        ivec2 sourceSize = ivec2(aeSourceSize);
        ivec2 texel = ivec2(gl_FragCoord.xy);
        ivec2 start = texel * sourceSize / meterSize;
        ivec2 end = max((texel + 1) * sourceSize / meterSize, start + 1);

        // sampled two by two texels, between the four, where the bilinear filter weights them
        // equally - or between two, or at one, at the edges of a block of an odd size
        vec3 sum = vec3(0.0);
        float count = 0.0;
        for (int y = start.y; y < end.y; y += 2) {
            int h = min(2, end.y - y);
            for (int x = start.x; x < end.x; x += 2) {
                int w = min(2, end.x - x);
                vec2 uv = (vec2(x, y) + vec2(w, h) * 0.5) / aeSourceSize;
                float n = float(w * h);
                sum += texture2DLod(aeSourceTexture, uv, 0.0).rgb * n;
                count += n;
            }
        }

        // the position in 16 bits, the high and the low byte in the red and the green channel
        float luminance = dot(sum / count, vec3(0.2126, 0.7152, 0.0722));
        float position = clamp((log2(max(luminance, 1.0e-10)) - aeRange.x) * aeRange.y, 0.0, 1.0);
        float value = floor(position * 65535.0 + 0.5);
        float high = floor(value / 256.0);
        gl_FragColor = vec4(high, value - high * 256.0, 0.0, 255.0) / 255.0;
    }
`;
