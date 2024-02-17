/**
 * @type {ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\nattribute vec3 aPosition;\nattribute vec2 aUv0;\n\nuniform mat4 matrix_model;\nuniform mat4 matrix_viewProjection;\nuniform float uTime;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    vec4 pos = matrix_model * vec4(aPosition, 1.0);\n    pos.x += sin(uTime + pos.y * 4.0) * 0.1;\n    pos.y += cos(uTime + pos.x * 4.0) * 0.1;\n    vUv0 = aUv0;\n    gl_Position = matrix_viewProjection * pos;\n}",
        "shader.frag": "\nprecision mediump float;\n\nuniform sampler2D uDiffuseMap;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    gl_FragColor = texture2D(uDiffuseMap, vUv0);\n}"
    }
};
