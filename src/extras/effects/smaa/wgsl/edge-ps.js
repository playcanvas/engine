// SMAA luma edge detection, ported from the reference implementation:
// Copyright (C) 2013 Jorge Jimenez, Jose I. Echevarria, Belen Masia, Fernando Navarro, Diego
// Gutierrez, distributed under the MIT license (http://www.iryoku.com/smaa/).
export default /* wgsl */`
    varying uv0: vec2f;
    var smaaColorTexture: texture_2d<f32>;
    var smaaColorTextureSampler: sampler;

    // 1 / width, 1 / height, width, height of the scene
    uniform smaaMetrics: vec4f;

    // threshold, maximum search steps, maximum diagonal search steps, corner rounding
    uniform smaaParams: vec4f;

    // the exposure the scene is displayed with
    uniform smaaExposure: f32;

    // an edge much weaker than one next to it is not an edge of its own
    const SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR: f32 = 2.0;

    // The brightness of the scene as displayed. The scene is linear HDR, before the exposure and
    // the tone mapping, while the edge threshold applies to the brightness the eye perceives - so
    // the exposed luma is compressed by a Reinhard curve and gamma encoded, approximating the
    // displayed value whatever the tone mapping. It is premultiplied by the alpha, as the color of
    // a transparent pixel is not displayed.
    fn smaaLuma(uv: vec2f) -> f32 {
        let color = textureSampleLevel(smaaColorTexture, smaaColorTextureSampler, uv, 0.0);
        let luma = clamp(dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722)) * (color.a * uniform.smaaExposure), 0.0, 1.0e4);
        return sqrt(luma / (1.0 + luma));
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let texel = uniform.smaaMetrics.xy;

        // the brightness differences to the left and the top neighbours
        let L = smaaLuma(uv0);
        let Lleft = smaaLuma(uv0 - vec2f(texel.x, 0.0));
        let Ltop = smaaLuma(uv0 - vec2f(0.0, texel.y));
        var delta = vec4f(abs(L - vec2f(Lleft, Ltop)), 0.0, 0.0);
        var edges = step(vec2f(uniform.smaaParams.x), delta.xy);

        // most pixels have no edge, and leave the cleared target as it is
        if (dot(edges, vec2f(1.0)) == 0.0) {
            discard;
        }

        // the differences to the right and the bottom neighbours
        let Lright = smaaLuma(uv0 + vec2f(texel.x, 0.0));
        let Lbottom = smaaLuma(uv0 + vec2f(0.0, texel.y));
        delta = vec4f(delta.xy, abs(L - vec2f(Lright, Lbottom)));
        var maxDelta = max(delta.xy, delta.zw);

        // the differences between the left and the left-left, and the top and the top-top
        let Lleftleft = smaaLuma(uv0 - vec2f(2.0 * texel.x, 0.0));
        let Ltoptop = smaaLuma(uv0 - vec2f(0.0, 2.0 * texel.y));
        delta = vec4f(delta.xy, abs(vec2f(Lleft, Ltop) - vec2f(Lleftleft, Ltoptop)));
        maxDelta = max(maxDelta.xy, delta.zw);
        let finalDelta = max(maxDelta.x, maxDelta.y);

        // local contrast adaptation
        edges = edges * step(vec2f(finalDelta), SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR * delta.xy);

        output.color = vec4f(edges, 0.0, 0.0);
        return output;
    }
`;
