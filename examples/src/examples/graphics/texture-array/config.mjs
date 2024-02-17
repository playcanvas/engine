/**
 * @type {ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n            attribute vec3 aPosition;\n            attribute vec2 aUv0;\n            attribute vec3 aNormal;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n            uniform mat3 matrix_normal;\n\n            varying vec2 vUv0;\n            varying vec3 worldNormal;\n\n            void main(void)\n            {\n                vUv0 = aUv0;\n                worldNormal = normalize(matrix_normal * aNormal);\n                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);\n            }",
        "shader.frag": "\n            varying vec2 vUv0;\n            varying vec3 worldNormal;\n            uniform float uTime;\n\n            uniform mediump sampler2DArray uDiffuseMap;\n\n            void main(void)\n            {\n                // sample different texture based on time along its texture v-coordinate\n                float index = (sin(uTime + vUv0.y + vUv0.x * 0.5) * 0.5 + 0.5) * 4.0;\n                vec4 data = texture(uDiffuseMap, vec3(vUv0, floor(index)));\n\n                data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting\n                gl_FragColor = vec4(data.rgb, 1.0);\n            }",
        "ground.frag": "\n            varying vec2 vUv0;\n            varying vec3 worldNormal;\n\n            uniform mediump sampler2DArray uDiffuseMap;\n\n            void main(void)\n            {\n                vec4 data = texture(uDiffuseMap, vec3(vUv0, step(vUv0.x, 0.5) + 2.0 * step(vUv0.y, 0.5)));\n                data.rgb *= 0.8 * max(dot(worldNormal, vec3(0.1, 1.0, 0.5)), 0.0) + 0.5; // simple lighting\n                gl_FragColor = vec4(data.rgb, 1.0);\n            }"
    }
};
