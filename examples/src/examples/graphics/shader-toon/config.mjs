/**
 * @type {ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n// Attributes per vertex: position, normal and texture coordinates\nattribute vec4 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aUv;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\nuniform mat4   matrix_view;\nuniform mat3   matrix_normal;\nuniform vec3   uLightPos;\n\n// Color to fragment program\nvarying float vertOutTexCoord;\nvarying vec2 texCoord;\n\nvoid main(void)\n{\n    mat4 modelView = matrix_view * matrix_model;\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n\n    // Get surface normal in eye coordinates\n    vec3 eyeNormal = normalize(matrix_normal * aNormal);\n\n    // Get vertex position in eye coordinates\n    vec4 vertexPos = modelView * aPosition;\n    vec3 vertexEyePos = vertexPos.xyz / vertexPos.w;\n\n    // Get vector to light source\n    vec3 lightDir = normalize(uLightPos - vertexEyePos);\n\n    // Dot product gives us diffuse intensity. The diffuse intensity will be\n    // used as the 1D color texture coordinate to look for the color of the\n    // resulting fragment (see fragment shader).\n    vertOutTexCoord = max(0.0, dot(eyeNormal, lightDir));\n    texCoord = aUv;\n\n    // Transform the geometry\n    gl_Position = modelViewProj * aPosition;\n}",
        "shader.frag": "\nprecision mediump float;\nuniform sampler2D uTexture;\nvarying float vertOutTexCoord;\nvarying vec2 texCoord;\nvoid main(void)\n{\n    float v = vertOutTexCoord;\n    v = float(int(v * 6.0)) / 6.0;\n    // vec4 color = texture2D (uTexture, texCoord); // try this to use the diffuse color.\n    vec4 color = vec4(0.5, 0.47, 0.43, 1.0);\n    gl_FragColor = color * vec4(v, v, v, 1.0);\n}\n"
    }
};
