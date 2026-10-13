// SMAA neighborhood blending, ported from the reference implementation:
// Copyright (C) 2013 Jorge Jimenez, Jose I. Echevarria, Belen Masia, Fernando Navarro, Diego
// Gutierrez, distributed under the MIT license (http://www.iryoku.com/smaa/).
export default /* wgsl */`
    varying uv0: vec2f;
    var smaaColorTexture: texture_2d<f32>;
    var smaaColorTextureSampler: sampler;
    var smaaBlendTexture: texture_2d<f32>;
    var smaaBlendTextureSampler: sampler;

    // 1 / width, 1 / height, width, height of the scene
    uniform smaaMetrics: vec4f;

    // the exposure the scene is displayed with
    uniform smaaExposure: f32;

    #include "reversibleTonemapPS"

    // The scene is linear HDR, where blending a bright pixel with a dark one by half gives a
    // result still displayed as bright as the bright one - so the edge would stay aliased. The
    // colors are blended compressed by a reversible tone mapping of their exposed values instead,
    // and expanded back after.
    fn smaaCompress(color: vec4f, exposure: f32) -> vec4f {
        return vec4f(reversibleTonemap(color.rgb * exposure), color.a);
    }

    fn smaaExpand(color: vec4f, exposure: f32) -> vec4f {
        return vec4f(reversibleTonemapInverse(color.rgb) / exposure, color.a);
    }

    fn sampleColor(uv: vec2f) -> vec4f {
        return textureSampleLevel(smaaColorTexture, smaaColorTextureSampler, uv, 0.0);
    }

    fn sampleBlend(uv: vec2f) -> vec4f {
        return textureSampleLevel(smaaBlendTexture, smaaBlendTextureSampler, uv, 0.0);
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let texel = uniform.smaaMetrics.xy;

        // the blending weights of the pixel, along with those its right and bottom neighbours
        // hold for it
        let own = sampleBlend(uv0);
        let a = vec4f(
            sampleBlend(uv0 + vec2f(texel.x, 0.0)).a,
            sampleBlend(uv0 + vec2f(0.0, texel.y)).g,
            own.z,
            own.x
        );

        var color = sampleColor(uv0);

        // a pixel on an edge blends with its neighbours on either side, along the direction of the
        // stronger edge
        if (dot(a, vec4f(1.0)) >= 1.0e-5) {
            let horizontal = max(a.x, a.z) > max(a.y, a.w);
            let dir = select(vec2f(0.0, texel.y), vec2f(texel.x, 0.0), horizontal);
            let fraction = select(a.yw, a.xz, horizontal);
            let weight = fraction / dot(fraction, vec2f(1.0));

            let e = max(uniform.smaaExposure, 1.0e-6);
            let center = smaaCompress(color, e);
            let positive = smaaCompress(sampleColor(uv0 + dir), e);
            let negative = smaaCompress(sampleColor(uv0 - dir), e);
            let blended = weight.x * mix(center, positive, fraction.x) + weight.y * mix(center, negative, fraction.y);
            color = smaaExpand(blended, e);
        }

        output.color = color;
        return output;
    }
`;
