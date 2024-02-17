/**
 * @type {ExampleConfig}
 */
export default {
    FILES: {
        "shader.vert": "\n            uniform float uTime;\n            varying float height;\n\n            void main(void)\n            {\n                // evaluate center of the splat in object space\n                vec3 centerLocal = evalCenter();\n\n                // modify it\n                float heightIntensity = centerLocal.y * 0.2;\n                centerLocal.x += sin(uTime * 5.0 + centerLocal.y) * 0.3 * heightIntensity;\n\n                // output y-coordinate\n                height = centerLocal.y;\n\n                // evaluate the rest of the splat using world space center\n                vec4 centerWorld = matrix_model * vec4(centerLocal, 1.0);\n                gl_Position = evalSplat(centerWorld);\n            }\n        ",
        "shader.frag": "\n            uniform float uTime;\n            varying float height;\n\n            void main(void)\n            {\n                // get splat color and alpha\n                gl_FragColor = evalSplat();\n\n                // modify it\n                vec3 gold = vec3(1.0, 0.85, 0.0);\n                float sineValue = abs(sin(uTime * 5.0 + height));\n                float blend = smoothstep(0.9, 1.0, sineValue);\n                gl_FragColor.xyz = mix(gl_FragColor.xyz, gold, blend);\n            }\n        "
    }
};
