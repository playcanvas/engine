export default /* wgsl */`
    uniform fringingIntensity: f32;

    fn applyFringing(scene: vec4f, uv: vec2f) -> vec4f {
        // offset depends on the direction from the center
        let centerDistance = uv - 0.5;
        let offset = uniform.fringingIntensity * centerDistance * centerDistance;

        var sceneOut = scene;
        sceneOut.r = textureSample(sceneTexture, sceneTextureSampler, uv - offset).r;
        sceneOut.b = textureSample(sceneTexture, sceneTextureSampler, uv + offset).b;
        return sceneOut;
    }
`;
