import { SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';

/**
 * @import { ShaderDesc } from '../../scene/materials/shader-material.js'
 */

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
        uniform float uDepth;

        void main(void) {
            if (uColor.a < 1.0 / 255.0) {
                discard;
            }
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(uColor)), uColor.a);
            #if DEPTH_WRITE == 1
                gl_FragDepth = uDepth;
            #endif
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
        uniform uDepth: f32;

        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;
            if (uniform.uColor.a < 1.0 / 255.0) {
                discard;
            }
            output.color = vec4f(gammaCorrectOutput(decodeGamma(uniform.uColor)), uniform.uColor.a);
            #if DEPTH_WRITE == 1
                output.fragDepth = uniform.uDepth;
            #endif
            return output;
        }
    `
};

/**
 * The unlit shader of a batch of lines, each an instance with its own transform and colors. The
 * occluded pass reads the occluded color with OCCLUDED defined.
 *
 * @type {ShaderDesc}
 */
export const lineBatchShader = {
    uniqueName: 'gizmo-line-batch',
    attributes: {
        vertex_position: SEMANTIC_POSITION,
        instance_row0: SEMANTIC_ATTR8,
        instance_row1: SEMANTIC_ATTR9,
        instance_row2: SEMANTIC_ATTR10,
        instance_color: SEMANTIC_ATTR11,
        instance_occludedColor: SEMANTIC_ATTR12
    },
    vertexGLSL: /* glsl */`
        attribute vec3 vertex_position;
        attribute vec4 instance_row0;
        attribute vec4 instance_row1;
        attribute vec4 instance_row2;
        attribute vec4 instance_color;
        attribute vec4 instance_occludedColor;

        uniform mat4 matrix_viewProjection;

        flat varying vec4 vColor;

        void main(void) {
            mat4 model = mat4(
                instance_row0.x, instance_row1.x, instance_row2.x, 0.0,
                instance_row0.y, instance_row1.y, instance_row2.y, 0.0,
                instance_row0.z, instance_row1.z, instance_row2.z, 0.0,
                instance_row0.w, instance_row1.w, instance_row2.w, 1.0
            );
            gl_Position = matrix_viewProjection * model * vec4(vertex_position, 1.0);
            gl_Position.z = clamp(gl_Position.z, -abs(gl_Position.w), abs(gl_Position.w));
            #ifdef OCCLUDED
                vColor = instance_occludedColor;
            #else
                vColor = instance_color;
            #endif
        }
    `,
    fragmentGLSL: /* glsl */`
        #include "gammaPS"

        precision highp float;

        flat varying vec4 vColor;

        void main(void) {
            if (vColor.a < 1.0 / 255.0) {
                discard;
            }
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(vColor)), vColor.a);
        }
    `,
    vertexWGSL: /* wgsl */`
        attribute vertex_position: vec3f;
        attribute instance_row0: vec4f;
        attribute instance_row1: vec4f;
        attribute instance_row2: vec4f;
        attribute instance_color: vec4f;
        attribute instance_occludedColor: vec4f;

        uniform matrix_viewProjection: mat4x4f;

        varying @interpolate(flat, either) vColor: vec4f;

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            let r0 = input.instance_row0;
            let r1 = input.instance_row1;
            let r2 = input.instance_row2;
            let model = mat4x4f(
                vec4f(r0.x, r1.x, r2.x, 0.0),
                vec4f(r0.y, r1.y, r2.y, 0.0),
                vec4f(r0.z, r1.z, r2.z, 0.0),
                vec4f(r0.w, r1.w, r2.w, 1.0)
            );
            output.position = uniform.matrix_viewProjection * model * vec4f(input.vertex_position, 1.0);
            output.position.z = clamp(output.position.z, -abs(output.position.w), abs(output.position.w));
            #ifdef OCCLUDED
                output.vColor = input.instance_occludedColor;
            #else
                output.vColor = input.instance_color;
            #endif
            return output;
        }
    `,
    fragmentWGSL: /* wgsl */`
        #include "gammaPS"

        varying @interpolate(flat, either) vColor: vec4f;

        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;
            if (input.vColor.a < 1.0 / 255.0) {
                discard;
            }
            output.color = vec4f(gammaCorrectOutput(decodeGamma(input.vColor)), input.vColor.a);
            return output;
        }
    `
};
