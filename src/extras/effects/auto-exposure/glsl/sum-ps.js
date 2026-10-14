// Sums the histograms of the rows of the meter into the histogram of the whole screen, four bins
// per texel, which is read back to the CPU.
export default /* glsl */`
    uniform highp usampler2D aeRowsTexture;

    void main() {
        int column = int(gl_FragCoord.x);
        uvec4 counts = uvec4(0u);
        for (int row = 0; row < {AE_METER_HEIGHT}; row++) {
            counts += texelFetch(aeRowsTexture, ivec2(column, row), 0);
        }
        gl_FragColor = counts;
    }
`;
