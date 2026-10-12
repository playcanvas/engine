export default /* glsl */`
    uniform sampler2D lensFlareTexture;
    uniform float lensFlareIntensity;

    // Global variable for debug
    vec3 dLensFlare;

    vec3 applyLensFlare(vec3 color, vec2 uv) {
        dLensFlare = texture2DLod(lensFlareTexture, uv, 0.0).rgb * lensFlareIntensity;
        return color + dLensFlare;
    }

    // the 'lensflare' debug view, displaying the flares as they are added to the scene
    vec3 debugLensflare() {
        return dLensFlare;
    }
`;
