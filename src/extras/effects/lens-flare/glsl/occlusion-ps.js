// Measures the visibility of each lens flare source: samples the scene depth in a disc around the
// projected source and counts the samples the scene does not occlude, blending the fraction with
// the previous frame's for a gradual change. Renders one pixel per flare, in the order of the
// flares - see FramePassLensFlare for the layout of the uniforms.
export default /* glsl */`
    #include "screenDepthPS"

    uniform sampler2D lensFlarePrevVisibility;

    // two per flare: xy source NDC, z source depth, w occlusion radius; x blend factor, y on screen
    uniform vec4 lensFlareOcclusion[64];

    // x: aspect ratio of the screen (height / width)
    uniform vec4 lensFlareParams;

    void main(void) {
        int index = int(gl_FragCoord.x);
        vec4 source = lensFlareOcclusion[index * 2];
        vec4 control = lensFlareOcclusion[index * 2 + 1];
        float previous = texelFetch(lensFlarePrevVisibility, ivec2(index, 0), 0).r;

        // off screen keeps the last measured visibility
        float visibility = previous;
        if (control.y > 0.5) {
            // on screen: sample the depth in a disc around the source, sized in screen heights
            vec2 center = source.xy * 0.5 + 0.5;
            float radius = max(source.w, 0.0005);
            float visible = 0.0;
            for (int i = 0; i < 24; i++) {
                float t = (float(i) + 0.5) / 24.0;
                float angle = float(i) * 2.39996323;
                vec2 offset = sqrt(t) * radius * vec2(cos(angle) * lensFlareParams.x, sin(angle));
                float depth = getLinearScreenDepth(getImageEffectUV(center + offset));
                visible += depth > source.z ? 1.0 : 0.0;
            }
            visibility = visible / 24.0;
        } else if (control.y < -0.5) {
            // behind the camera
            visibility = 0.0;
        }

        // move towards the measured visibility by the blend factor, but by at least one step of
        // the 8-bit storage, so that the fade cannot stall short of the target
        float diff = visibility - previous;
        float stepSize = sign(diff) * max(abs(diff) * control.x, 1.0 / 255.0);
        float result = abs(stepSize) >= abs(diff) ? visibility : previous + stepSize;
        gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
    }
`;
