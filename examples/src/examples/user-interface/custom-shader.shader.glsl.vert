
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
}