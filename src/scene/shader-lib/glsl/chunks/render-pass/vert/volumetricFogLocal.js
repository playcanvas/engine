// A vertex shader rendering a quad covering the projected screen space bounds of a local light
// volume, used by the volumetric fog local lights pass. Note that the generated uv0 addresses the
// full render target, and not just the quad, so the fragment shader can sample screen space
// textures with it.
export default /* glsl */`
    attribute vec2 aPosition;

    // normalized device coordinates of the light volume bounds: xy = min, zw = max
    uniform vec4 uVolLightRect;

    varying vec2 uv0;

    void main(void)
    {
        vec2 ndc = mix(uVolLightRect.xy, uVolLightRect.zw, aPosition * 0.5 + 0.5);
        gl_Position = vec4(ndc, 0.0, 1.0);
        uv0 = getImageEffectUV(ndc * 0.5 + 0.5);
    }
`;
