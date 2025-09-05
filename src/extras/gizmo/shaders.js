import { SEMANTIC_POSITION } from '../../platform/graphics/constants.js';

/** @import { ShaderDesc } from '../../scene/materials/shader-material.js'; */

/**
 * @type {ShaderDesc}
 */
export const unlitShader = {
    uniqueName: 'gizmo-unlit',
    attributes: {
        vertex_position: SEMANTIC_POSITION
    },
    vertexGLSL: /* glsl */`
        attribute vec3 vertex_position;
    
        uniform mat4 matrix_model;
        uniform mat4 matrix_viewProjection;
    
        void main(void) {
            gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
            gl_Position.z = clamp(gl_Position.z, -abs(gl_Position.w), abs(gl_Position.w));
        }
    `,
    fragmentGLSL: /* glsl */`
        #include "gammaPS"
    
        precision highp float;
    
        uniform vec4 uColor;

        void main(void) {
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(uColor)), uColor.w);
            gl_FragDepth = 0.0;
        }
    `,
    vertexWGSL: /* wgsl */`
        attribute vertex_position: vec3f;

        uniform matrix_model: mat4x4f;
        uniform matrix_viewProjection: mat4x4f;

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            let pos = vec4f(input.vertex_position, 1.0);
            output.position = uniform.matrix_viewProjection * uniform.matrix_model * pos;
            output.position.z = clamp(output.position.z, -abs(output.position.w), abs(output.position.w));
            return output;
        }
    `,
    fragmentWGSL: /* wgsl */`
        #include "gammaPS"

        uniform uColor: vec4f;

        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;
            output.color = vec4f(gammaCorrectOutput(decodeGamma(uniform.uColor)), uniform.uColor.w);
            output.fragDepth = 0.0;
            return output;
        }
    `
};
