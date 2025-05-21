// A simple vertex shader used to render a quad, which requires 'vec2 aPosition' in the vertex
// buffer, and generates uv coordinates uv0 for use in the fragment shader.
export default /* glsl */`
    attribute vec2 aPosition;
    varying vec2 uv0;
    void main(void)
    {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        uv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);
    }
`;
