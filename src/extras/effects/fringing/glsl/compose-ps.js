export default /* glsl */`
    uniform float fringingIntensity;

    vec4 applyFringing(vec4 scene, vec2 uv) {
        // offset depends on the direction from the center
        vec2 centerDistance = uv - 0.5;
        vec2 offset = fringingIntensity * centerDistance * centerDistance;

        scene.r = texture2D(sceneTexture, uv - offset).r;
        scene.b = texture2D(sceneTexture, uv + offset).b;
        return scene;
    }
`;
