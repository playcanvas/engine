export default /* glsl */`
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
        #ifndef WEBGPU
            uv0.y = 1.0 - uv0.y;
        #endif
    }
`;
