// Measures the visibility of each lens flare source: samples the scene depth in a disc around the
// projected source and counts the samples the scene does not occlude, blending the fraction with
// the previous frame's for a gradual change. Renders one pixel per flare, in the order of the
// flares - see FramePassLensFlare for the layout of the uniforms.
export default /* wgsl */`
    #include "screenDepthPS"

    var lensFlarePrevVisibility: texture_2d<f32>;

    // two per flare: xy source NDC, z source depth, w occlusion radius; x blend factor, y on screen
    uniform lensFlareOcclusion: array<vec4f, 64>;

    // x: aspect ratio of the screen (height / width)
    uniform lensFlareParams: vec4f;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        let index = i32(pcPosition.x);
        let source = uniform.lensFlareOcclusion[index * 2];
        let control = uniform.lensFlareOcclusion[index * 2 + 1];
        let previous = textureLoad(lensFlarePrevVisibility, vec2i(index, 0), 0).r;

        // off screen keeps the last measured visibility
        var visibility = previous;
        if (control.y > 0.5) {
            // on screen: sample the depth in a disc around the source, sized in screen heights
            let center = source.xy * 0.5 + 0.5;
            let radius = max(source.w, 0.0005);
            var visible = 0.0;
            for (var i: i32 = 0; i < 24; i++) {
                let t = (f32(i) + 0.5) / 24.0;
                let angle = f32(i) * 2.39996323;
                let offset = sqrt(t) * radius * vec2f(cos(angle) * uniform.lensFlareParams.x, sin(angle));
                let depth = getLinearScreenDepth(getImageEffectUV(center + offset));
                visible += select(0.0, 1.0, depth > source.z);
            }
            visibility = visible / 24.0;
        } else if (control.y < -0.5) {
            // behind the camera
            visibility = 0.0;
        }

        // move towards the measured visibility by the blend factor, but by at least one step of
        // the 8-bit storage, so that the fade cannot stall short of the target
        let diff = visibility - previous;
        let stepSize = sign(diff) * max(abs(diff) * control.x, 1.0 / 255.0);
        let result = select(previous + stepSize, visibility, abs(stepSize) >= abs(diff));
        output.color = vec4f(result, 0.0, 0.0, 1.0);
        return output;
    }
`;
