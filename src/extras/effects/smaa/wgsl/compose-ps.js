export default /* wgsl */`
    // the debug views, declared only while a debug view is displayed
    #ifdef COMPOSE_EFFECT_DEBUG
        var smaaEdgesTexture: texture_2d<f32>;
        var smaaEdgesTextureSampler: sampler;
        var smaaWeightsTexture: texture_2d<f32>;
        var smaaWeightsTextureSampler: sampler;

        // the pixel sampled, flipped like the composition samples the scene
        fn smaaDebugUv() -> vec2f {
            return vec2f(uv0.x, mix(uv0.y, 1.0 - uv0.y, uniform.composeTargetFlipY));
        }

        // the 'smaaedges' debug view: the edges found, red on the left side of a pixel and green on
        // its top
        fn debugSmaaedges() -> vec3f {
            return vec3f(textureSampleLevel(smaaEdgesTexture, smaaEdgesTextureSampler, smaaDebugUv(), 0.0).rg, 0.0);
        }

        // the 'smaaweights' debug view: how much each pixel blends with its neighbours, red along
        // horizontal edges and green along vertical ones
        fn debugSmaaweights() -> vec3f {
            let weights = textureSampleLevel(smaaWeightsTexture, smaaWeightsTextureSampler, smaaDebugUv(), 0.0);
            return vec3f(weights.r + weights.g, weights.b + weights.a, 0.0);
        }
    #endif
`;
