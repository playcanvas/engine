/**
 * @type {ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": "\n            // Attributes per vertex: position and uv\n            attribute vec4 aPosition;\n            attribute vec2 aUv0;\n        \n            // model matrix of the mesh\n            uniform mat4 matrix_model;\n\n            // decal view-projection matrix (orthographic)\n            uniform mat4 matrix_decal_viewProj;\n\n            // decal projected position to fragment program\n            varying vec4 decalPos;\n\n            void main(void)\n            {\n                // handle upside-down uv coordinates on WebGPU\n                vec2 uv = getImageEffectUV(aUv0);\n\n                // We render in texture space, so a position of this fragment is its uv-coordinates.\n                // Change the range of uv coordinates from 0..1 to projection space -1 to 1.\n                gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0, 1.0);\n\n                // transform the vertex position to world space and then to decal space, and pass it\n                // to the fragment shader to sample the decal texture\n                vec4 worldPos = matrix_model * aPosition;\n                decalPos = matrix_decal_viewProj * worldPos;\n            }",
        "shader.frag": "\n            precision lowp float;\n            varying vec4 decalPos;\n            uniform sampler2D uDecalMap;\n\n            void main(void)\n            {\n                // decal space position from -1..1 range, to texture space range 0..1\n                vec4 p = decalPos * 0.5 + 0.5;\n \n                // if the position is outside out 0..1 projection box, ignore the pixel\n                if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0)\n                    discard;\n\n                gl_FragColor = texture2D(uDecalMap, p.xy);\n            }"
    }
};
