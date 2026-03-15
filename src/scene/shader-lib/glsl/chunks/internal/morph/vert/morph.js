// vertex shader internally used to apply morph targets in textures into a final texture containing
// blended morph targets
export default /* glsl */`
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
    }
`;
