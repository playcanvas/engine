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

varying vec2 vUv0;

void main(void)
{
    vUv0 = aUv0;
    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
}`,
        "shader.frag": /* glsl */`
precision mediump float;

varying vec2 vUv0;

uniform sampler2D uDiffuseMap;
uniform sampler2D uHeightMap;
uniform float uTime;

void main(void)
{
    float height = texture2D(uHeightMap, vUv0).r;
    vec4 color = texture2D(uDiffuseMap, vUv0);
    if (height < uTime) {
    discard;
    }
    if (height < (uTime + uTime * 0.1)) {
    color = vec4(1.0, 0.2, 0.0, 1.0);
    }
    gl_FragColor = color;
}`
    }
};
