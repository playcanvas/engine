
/**
 * Simple Screen-Space Vertex Shader with one UV coordinate.
 * This shader is useful for simple UI shaders.
 * 
 * Usage: the following attributes must be configured when creating a new pc.Shader:
 *   vertex_position: pc.SEMANTIC_POSITION
 *   vertex_texCoord0: pc.SEMANTIC_TEXCOORD0
 */

// Default PlayCanvas uniforms
uniform matrix_viewProjection: mat4x4f;
uniform matrix_model: mat4x4f;

// Additional inputs
attribute vertex_position: vec3f;
attribute vertex_texCoord0: vec2f;

// Additional shader outputs
varying vUv0: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // UV is simply passed along as varying
    output.vUv0 = input.vertex_texCoord0;

    // Position for screen-space
    var pos: vec4f = uniform.matrix_model * vec4f(input.vertex_position, 1.0);
    output.position = vec4f(pos.xy, 0.0, 1.0);
    
    return output;
}

