/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    FILES: {
        "shader.vert": "\n            // Attributes per vertex: position\n            attribute vec4 aPosition;\n            attribute vec4 aColor;\n            \n            uniform mat4   matrix_viewProjection;\n            uniform mat4   matrix_model;\n            \n            // Color to fragment program\n            varying vec4 outColor;\n            \n            void main(void)\n            {\n                mat4 modelViewProj = matrix_viewProjection * matrix_model;\n                gl_Position = modelViewProj * aPosition;\n            \n                // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0\n                #ifndef WEBGPU\n                    gl_PointSize = 1.5;\n                #endif\n            \n                outColor = aColor;\n            }",
        "shader.frag": "\n            precision lowp float;\n            varying vec4 outColor;\n            \n            void main(void)\n            {\n                // just output color supplied by vertex shader\n                gl_FragColor = outColor;\n            }"
    }
};
