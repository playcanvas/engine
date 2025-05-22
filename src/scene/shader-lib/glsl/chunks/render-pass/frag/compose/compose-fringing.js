export default /* glsl */`
    #ifdef FRINGING
        uniform float fringingIntensity;

        vec3 applyFringing(vec3 color, vec2 uv) {
            // offset depends on the direction from the center
            vec2 centerDistance = uv - 0.5;
            vec2 offset = fringingIntensity * pow(centerDistance, vec2(2.0, 2.0));

            color.r = texture2D(sceneTexture, uv - offset).r;
            color.b = texture2D(sceneTexture, uv + offset).b;
            return color;
        }
    #endif
`;
