export default /* wgsl */`
    #ifdef FRINGING
        uniform fringingIntensity: f32;

        fn applyFringing(color: vec3f, uv: vec2f) -> vec3f {
            // offset depends on the direction from the center
            let centerDistance = uv - 0.5;
            let offset = uniform.fringingIntensity * pow(centerDistance, vec2f(2.0));

            var colorOut = color;
            colorOut.r = textureSample(sceneTexture, sceneTextureSampler, uv - offset).r;
            colorOut.b = textureSample(sceneTexture, sceneTextureSampler, uv + offset).b;
            return colorOut;
        }
    #endif
`;
