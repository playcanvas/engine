// SMAA luma edge detection, ported from the reference implementation:
// Copyright (C) 2013 Jorge Jimenez, Jose I. Echevarria, Belen Masia, Fernando Navarro, Diego
// Gutierrez, distributed under the MIT license (http://www.iryoku.com/smaa/).
export default /* glsl */`
    varying vec2 uv0;
    uniform sampler2D smaaColorTexture;

    // 1 / width, 1 / height, width, height of the scene
    uniform vec4 smaaMetrics;

    // threshold, maximum search steps, maximum diagonal search steps, corner rounding
    uniform vec4 smaaParams;

    // the exposure the scene is displayed with
    uniform float smaaExposure;

    // an edge much weaker than one next to it is not an edge of its own
    #define SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR 2.0

    // The brightness of the scene as displayed. The scene is linear HDR, before the exposure and
    // the tone mapping, while the edge threshold applies to the brightness the eye perceives - so
    // the exposed luma is compressed by a Reinhard curve and gamma encoded, approximating the
    // displayed value whatever the tone mapping. It is premultiplied by the alpha, as the color of
    // a transparent pixel is not displayed.
    float smaaLuma(vec2 uv) {
        vec4 color = texture2DLod(smaaColorTexture, uv, 0.0);
        float luma = clamp(dot(color.rgb, vec3(0.2126, 0.7152, 0.0722)) * (color.a * smaaExposure), 0.0, 1.0e4);
        return sqrt(luma / (1.0 + luma));
    }

    void main(void) {
        vec2 texel = smaaMetrics.xy;

        // the brightness differences to the left and the top neighbours
        float L = smaaLuma(uv0);
        float Lleft = smaaLuma(uv0 - vec2(texel.x, 0.0));
        float Ltop = smaaLuma(uv0 - vec2(0.0, texel.y));
        vec4 delta;
        delta.xy = abs(L - vec2(Lleft, Ltop));
        vec2 edges = step(vec2(smaaParams.x), delta.xy);

        // most pixels have no edge, and leave the cleared target as it is
        if (dot(edges, vec2(1.0)) == 0.0) {
            discard;
        }

        // the differences to the right and the bottom neighbours
        float Lright = smaaLuma(uv0 + vec2(texel.x, 0.0));
        float Lbottom = smaaLuma(uv0 + vec2(0.0, texel.y));
        delta.zw = abs(L - vec2(Lright, Lbottom));
        vec2 maxDelta = max(delta.xy, delta.zw);

        // the differences between the left and the left-left, and the top and the top-top
        float Lleftleft = smaaLuma(uv0 - vec2(2.0 * texel.x, 0.0));
        float Ltoptop = smaaLuma(uv0 - vec2(0.0, 2.0 * texel.y));
        delta.zw = abs(vec2(Lleft, Ltop) - vec2(Lleftleft, Ltoptop));
        maxDelta = max(maxDelta.xy, delta.zw);
        float finalDelta = max(maxDelta.x, maxDelta.y);

        // local contrast adaptation
        edges.xy *= step(finalDelta, SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR * delta.xy);

        gl_FragColor = vec4(edges, 0.0, 0.0);
    }
`;
