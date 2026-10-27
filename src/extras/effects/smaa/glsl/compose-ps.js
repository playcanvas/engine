export default /* glsl */`
    // the debug views, declared only while a debug view is displayed
    #ifdef COMPOSE_EFFECT_DEBUG
        uniform sampler2D smaaEdgesTexture;
        uniform sampler2D smaaWeightsTexture;

        // the pixel sampled, flipped like the composition samples the scene
        vec2 smaaDebugUv() {
            return vec2(uv0.x, mix(uv0.y, 1.0 - uv0.y, composeTargetFlipY));
        }

        // the 'smaaedges' debug view: the edges found, red on the left side of a pixel and green on
        // its top
        vec3 debugSmaaedges() {
            return vec3(texture2DLod(smaaEdgesTexture, smaaDebugUv(), 0.0).rg, 0.0);
        }

        // the 'smaaweights' debug view: how much each pixel blends with its neighbours, red along
        // horizontal edges and green along vertical ones
        vec3 debugSmaaweights() {
            vec4 weights = texture2DLod(smaaWeightsTexture, smaaDebugUv(), 0.0);
            return vec3(weights.r + weights.g, weights.b + weights.a, 0.0);
        }
    #endif
`;
