// Counts the texels of one row of the meter into four bins of the histogram - the fragment at
// (i, row) counts bins 4i to 4i + 3 of that row. Rather than scattering each texel into its bin with
// blending, every fragment gathers the texels of its row, so the counts are exact without needing
// a blendable integer or float target. Each texel adds itself to its two nearest bins, weighted by
// its distance to them, so the histogram changes gradually as a texel moves between bins, and by
// the metering weight of its position on the screen. The counts are in 16.16 fixed point.
export default /* glsl */`
    uniform sampler2D aeMeterTexture;

    // how much the metering favors the center of the screen, 0-1
    uniform float aeCenterWeight;

    void main() {
        ivec2 fragment = ivec2(gl_FragCoord.xy);
        int row = fragment.y;
        vec4 bins = vec4(fragment.x * 4) + vec4(0.0, 1.0, 2.0, 3.0);

        // the metering weight of the texels of the row, by their distance to the center
        float v = (float(row) + 0.5) / float({AE_METER_HEIGHT}) - 0.5;

        uvec4 counts = uvec4(0u);
        for (int x = 0; x < {AE_METER_WIDTH}; x++) {
            vec2 bytes = floor(texelFetch(aeMeterTexture, ivec2(x, row), 0).rg * 255.0 + 0.5);
            float position = (bytes.r * 256.0 + bytes.g) / 65535.0 * float({AE_BINS} - 1);
            float u = (float(x) + 0.5) / float({AE_METER_WIDTH}) - 0.5;
            float weight = mix(1.0, exp(-8.0 * (u * u + v * v)), aeCenterWeight);
            vec4 share = max(vec4(0.0), 1.0 - abs(bins - position)) * weight;
            counts += uvec4(share * 65536.0 + 0.5);
        }

        gl_FragColor = counts;
    }
`;
