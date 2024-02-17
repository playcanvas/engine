/**
 * @type {ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n            attribute vec3 aPosition;\n            attribute vec2 aUv0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n\n            void main(void)\n            {\n                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);;\n            }",
        "shader.frag": "\n\n            // engine built-in constant storing render target size in .xy and inverse size in .zw\n            uniform vec4 uScreenSize;\n\n            // reflection texture\n            uniform sampler2D uDiffuseMap;\n\n            void main(void)\n            {\n                // sample reflection texture\n                vec2 coord = gl_FragCoord.xy * uScreenSize.zw;\n                coord.y = 1.0 - coord.y;\n                vec4 reflection = texture2D(uDiffuseMap, coord);\n\n                gl_FragColor = vec4(reflection.xyz * 0.7, 1);\n            }"
    }
};
