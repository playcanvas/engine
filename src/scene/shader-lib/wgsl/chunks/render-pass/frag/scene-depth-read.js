// Samples the scene depth over a region of the view, one sample per output pixel, and packs each one
// losslessly into RGBA8. Reading RGBA8 back is the one thing every device agrees on, and it is what
// makes the read work regardless of the format the depth itself was rendered to.
export default /* wgsl */`
    #include "screenDepthPS"
    #include "floatAsUintPS"

    // the region of the view to sample, normalized, and the number of samples across and down it
    uniform uDepthReadRect: vec4f;
    uniform uDepthReadGrid: vec2f;

    // at or beyond this depth nothing was rendered, and the sample is reported as the value below.
    // Infinity arrives as a uniform because WGSL rejects one written as a constant expression - a
    // bitcast of its bit pattern does not survive const evaluation.
    uniform uDepthReadFar: f32;
    uniform uDepthReadEmpty: f32;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // the centre of this output pixel, as a fraction of the region
        let cell = (floor(pcPosition.xy) + vec2f(0.5)) / uniform.uDepthReadGrid;
        let uv = uniform.uDepthReadRect.xy + cell * uniform.uDepthReadRect.zw;

        // snap to the centre of the nearest depth texel. The WGSL depth chunk fetches texels rather
        // than sampling, so this only has to land inside the intended texel, but it keeps both
        // languages doing the same arithmetic.
        let size = vec2f(textureDimensions(uSceneDepthMap, 0));
        let snapped = (floor(uv * size) + vec2f(0.5)) / size;

        let depth = getLinearScreenDepth(snapped);
        let value = select(depth, uniform.uDepthReadEmpty, depth >= uniform.uDepthReadFar);
        output.color = float2uint(value);
        return output;
    }
`;
