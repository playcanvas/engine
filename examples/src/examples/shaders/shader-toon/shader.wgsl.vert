
// Attributes per vertex: position, normal and texture coordinates
attribute aPosition: vec4f;
attribute aNormal: vec3f;
attribute aUv: vec2f;

uniform matrix_viewProjection: mat4x4f;
uniform matrix_model: mat4x4f;
uniform matrix_view: mat4x4f;
uniform matrix_normal: mat3x3f;
uniform uLightPos: vec3f;

// Color to fragment program
varying vertOutTexCoord: f32;
varying texCoord: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let modelView: mat4x4f = uniform.matrix_view * uniform.matrix_model;
    let modelViewProj: mat4x4f = uniform.matrix_viewProjection * uniform.matrix_model;

    // Get surface normal in eye coordinates
    let eyeNormal: vec3f = normalize(uniform.matrix_normal * aNormal);

    // Get vertex position in eye coordinates
    let vertexPos: vec4f = modelView * aPosition;
    let vertexEyePos: vec3f = vertexPos.xyz / vertexPos.w;

    // Get vector to light source
    let lightDir: vec3f = normalize(uniform.uLightPos - vertexEyePos);

    // Dot product gives us diffuse intensity. The diffuse intensity will be
    // used as the 1D color texture coordinate to look for the color of the
    // resulting fragment (see fragment shader).
    output.vertOutTexCoord = max(0.0, dot(eyeNormal, lightDir));
    output.texCoord = aUv;

    // Transform the geometry
    output.position = modelViewProj * aPosition;
    return output;
}