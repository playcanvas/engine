
// Attributes per vertex: position, normal and texture coordinates
attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;

uniform mat4   matrix_viewProjection;
uniform mat4   matrix_model;
uniform mat4   matrix_view;
uniform mat3   matrix_normal;
uniform vec3   uLightPos;

// Color to fragment program
varying float vertOutTexCoord;
varying vec2 texCoord;

void main(void)
{
    mat4 modelView = matrix_view * matrix_model;
    mat4 modelViewProj = matrix_viewProjection * matrix_model;

    // Get surface normal in eye coordinates
    vec3 eyeNormal = normalize(matrix_normal * aNormal);

    // Get vertex position in eye coordinates
    vec4 vertexPos = modelView * aPosition;
    vec3 vertexEyePos = vertexPos.xyz / vertexPos.w;

    // Get vector to light source
    vec3 lightDir = normalize(uLightPos - vertexEyePos);

    // Dot product gives us diffuse intensity. The diffuse intensity will be
    // used as the 1D color texture coordinate to look for the color of the
    // resulting fragment (see fragment shader).
    vertOutTexCoord = max(0.0, dot(eyeNormal, lightDir));
    texCoord = aUv;

    // Transform the geometry
    gl_Position = modelViewProj * aPosition;
}