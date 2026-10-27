export default /* glsl */`
attribute vec3 vertex_position;
uniform float projectionFlipY;
varying vec2 steadyUV;

void main(void) {
    gl_Position = vec4(vertex_position.xy * vec2(1.0, projectionFlipY), 0.0, 1.0);
    steadyUV = vertex_position.xy * 0.5 + 0.5;
}
`;
