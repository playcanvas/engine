#include "screenDepthPS"

attribute vertex_position: vec4f;
attribute vertex_texCoord0: vec2f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uTime: f32;
var uTexture: texture_2d<f32>;
var uTextureSampler: sampler;

varying texCoord0: vec2f;
varying texCoord1: vec2f;
varying texCoord2: vec2f;
varying screenPos: vec4f;
varying depth: f32;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // 3 scrolling texture coordinates with different direction and speed
    output.texCoord0 = vertex_texCoord0 * 2.0 + vec2f(uniform.uTime * 0.003, uniform.uTime * 0.01);
    output.texCoord1 = vertex_texCoord0 * 1.5 + vec2f(uniform.uTime * -0.02, uniform.uTime * 0.02);
    output.texCoord2 = vertex_texCoord0 * 1.0 + vec2f(uniform.uTime * 0.01, uniform.uTime * -0.003);

    // sample the fog texture to have elevation for this vertex
    let offsetTexCoord: vec2f = input.vertex_texCoord0 + vec2f(uniform.uTime * 0.001, uniform.uTime * -0.0003);
    let offset: f32 = textureSampleLevel(uTexture, uTextureSampler, offsetTexCoord, 0.0).r;

    // vertex in the world space
    var pos: vec4f = uniform.matrix_model * vertex_position;

    // move it up based on the offset
    pos.y = pos.y + offset * 25.0;

    // position in projected (screen) space
    let projPos: vec4f = uniform.matrix_viewProjection * pos;
    output.position = projPos;

    // the linear depth of the vertex (in camera space)
    output.depth = getLinearDepth(pos.xyz);

    // screen fragment position, used to sample the depth texture
    output.screenPos = projPos;

    return output;
}