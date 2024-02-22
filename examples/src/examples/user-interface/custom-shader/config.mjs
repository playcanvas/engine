/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": /* glsl */`
/**
 * Simple Screen-Space Vertex Shader with one UV coordinate.
 * This shader is useful for simple UI shaders.
 * 
 * Usage: the following attributes must be configured when creating a new pc.Shader:
 *   vertex_position: pc.SEMANTIC_POSITION
 *   vertex_texCoord0: pc.SEMANTIC_TEXCOORD0
 */

// Default PlayCanvas uniforms
uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;

// Additional inputs
attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;

// Additional shader outputs
varying vec2 vUv0;

void main(void) {
    // UV is simply passed along as varying
    vUv0 = vertex_texCoord0;

    // Position for screen-space
    gl_Position = matrix_model * vec4(vertex_position, 1.0);
    gl_Position.zw = vec2(0.0, 1.0);
}`,
        "shader.frag": /* glsl */`
/**
 * Simple Color-Inverse Fragment Shader with intensity control.
 * 
 * Usage: the following parameters must be set:
 *   uDiffuseMap: image texture.
 *   amount: float that controls the amount of the inverse-color effect. 0 means none (normal color), while 1 means full inverse.
 *
 * Additionally, the Vertex shader that is paired with this Fragment shader must specify:
 *   varying vec2 vUv0: for the UV.
 */

// The following line is for setting the shader precision for floats. It is commented out because, ideally, it must be configured
// on a per-device basis before loading the Shader. Please check the accompanying TypeScript code and look for 'app.graphicsDevice.precision'.

// precision mediump float;

// Additional varying from vertex shader
varying vec2 vUv0;

// Custom Parameters (must be set from code via material.setParameter())
uniform sampler2D uDiffuseMap;
uniform float amount;

void main(void)
{
    vec4 color = texture2D(uDiffuseMap, vUv0);
    vec3 roloc = 1.0 - color.rgb;
    gl_FragColor = vec4(mix(color.rgb, roloc, amount), color.a);
}`
    }
};
