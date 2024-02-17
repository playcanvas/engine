/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": /* glsl */`
attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;

varying vec2 vUv0;

void main(void)
{
    vec4 pos = matrix_model * vec4(aPosition, 1.0);
    pos.x += sin(uTime + pos.y * 4.0) * 0.1;
    pos.y += cos(uTime + pos.x * 4.0) * 0.1;
    vUv0 = aUv0;
    gl_Position = matrix_viewProjection * pos;
}`,
        "shader.frag": /* glsl */`
precision mediump float;

uniform sampler2D uDiffuseMap;

varying vec2 vUv0;

void main(void)
{
    gl_FragColor = texture2D(uDiffuseMap, vUv0);
}`
    }
};
