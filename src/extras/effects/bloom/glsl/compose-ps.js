export default /* glsl */`
    uniform sampler2D bloomTexture;
    uniform float bloomIntensity;

    // Global variable for debug
    vec3 dBloom;

    vec3 applyBloom(vec3 color, vec2 uv) {
        dBloom = texture2DLod(bloomTexture, uv, 0.0).rgb;
        return color + dBloom * bloomIntensity;
    }

    // the 'bloom' debug view, displaying the bloom as it is added to the scene
    vec3 debugBloom() {
        return dBloom * bloomIntensity;
    }
`;
