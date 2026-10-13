// SMAA neighborhood blending, ported from the reference implementation:
// Copyright (C) 2013 Jorge Jimenez, Jose I. Echevarria, Belen Masia, Fernando Navarro, Diego
// Gutierrez, distributed under the MIT license (http://www.iryoku.com/smaa/).
export default /* glsl */`
    varying vec2 uv0;
    uniform sampler2D smaaColorTexture;
    uniform sampler2D smaaBlendTexture;

    // 1 / width, 1 / height, width, height of the scene
    uniform vec4 smaaMetrics;

    // the exposure the scene is displayed with
    uniform float smaaExposure;

    #include "reversibleTonemapPS"

    // below this alpha, the color of a blended pixel is not divided out of its alpha
    #define SMAA_UNPREMULTIPLY_ALPHA (1.0 / 255.0)

    // The scene is linear HDR, where blending a bright pixel with a dark one by half gives a
    // result still displayed as bright as the bright one - so the edge would stay aliased. The
    // colors are blended compressed by a reversible tone mapping of their exposed values instead,
    // and expanded back after. The compressed colors are blended premultiplied by their alpha, so
    // that the color of a transparent pixel, which is not displayed, does not tint the pixels
    // blended with it - and the alpha is divided out before the expansion, which is not linear.
    vec4 smaaCompress(vec4 color, float exposure) {
        return vec4(reversibleTonemap(color.rgb * exposure) * color.a, color.a);
    }

    // the blended color, with its alpha divided out - a pixel left transparent keeps its color
    vec4 smaaExpand(vec4 blended, vec4 color, float exposure) {
        vec3 rgb = blended.a > SMAA_UNPREMULTIPLY_ALPHA ? reversibleTonemapInverse(blended.rgb / blended.a) / exposure : color.rgb;
        return vec4(rgb, blended.a);
    }

    void main(void) {
        vec2 texel = smaaMetrics.xy;

        // the blending weights of the pixel, along with those its right and bottom neighbours
        // hold for it
        vec4 a;
        a.x = texture2DLod(smaaBlendTexture, uv0 + vec2(texel.x, 0.0), 0.0).a;
        a.y = texture2DLod(smaaBlendTexture, uv0 + vec2(0.0, texel.y), 0.0).g;
        a.wz = texture2DLod(smaaBlendTexture, uv0, 0.0).xz;

        vec4 color = texture2DLod(smaaColorTexture, uv0, 0.0);

        // a pixel on an edge blends with its neighbours on either side, along the direction of the
        // stronger edge
        if (dot(a, vec4(1.0)) >= 1.0e-5) {
            bool horizontal = max(a.x, a.z) > max(a.y, a.w);
            vec2 dir = horizontal ? vec2(texel.x, 0.0) : vec2(0.0, texel.y);
            vec2 fraction = horizontal ? a.xz : a.yw;
            vec2 weight = fraction / dot(fraction, vec2(1.0));

            float e = max(smaaExposure, 1.0e-6);
            vec4 center = smaaCompress(color, e);
            vec4 positive = smaaCompress(texture2DLod(smaaColorTexture, uv0 + dir, 0.0), e);
            vec4 negative = smaaCompress(texture2DLod(smaaColorTexture, uv0 - dir, 0.0), e);
            vec4 blended = weight.x * mix(center, positive, fraction.x) + weight.y * mix(center, negative, fraction.y);
            color = smaaExpand(blended, color, e);
        }

        gl_FragColor = color;
    }
`;
