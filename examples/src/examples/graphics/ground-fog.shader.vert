attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;
uniform sampler2D uTexture;

varying vec2 texCoord0;
varying vec2 texCoord1;
varying vec2 texCoord2;
varying vec4 screenPos;
varying float depth;

void main(void)
{
    // 3 scrolling texture coordinates with different direction and speed
    texCoord0 = vertex_texCoord0 * 2.0 + vec2(uTime * 0.003, uTime * 0.01);
    texCoord1 = vertex_texCoord0 * 1.5 + vec2(uTime * -0.02, uTime * 0.02);
    texCoord2 = vertex_texCoord0 * 1.0 + vec2(uTime * 0.01, uTime * -0.003);

    // sample the fog texture to have elevation for this vertex
    vec2 offsetTexCoord = vertex_texCoord0 + vec2(uTime * 0.001, uTime * -0.0003);
    float offset = texture2D(uTexture, offsetTexCoord).r;

    // vertex in the world space
    vec4 pos = matrix_model * vec4(vertex_position, 1.0);

    // move it up based on the offset
    pos.y += offset * 25.0;

    // position in projected (screen) space
    vec4 projPos = matrix_viewProjection * pos;
    gl_Position = projPos;

    // the linear depth of the vertex (in camera space)
    depth = getLinearDepth(pos.xyz);

    // screen fragment position, used to sample the depth texture
    screenPos = projPos;
}
