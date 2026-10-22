import { SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_POSITION, SEMANTIC_TEXCOORD0 } from '../../platform/graphics/constants.js';

/**
 * @import { ShaderDesc } from '../../scene/materials/shader-material.js'
 */

/**
 * The unlit shader of a shape. TEXTURE scales the alpha by the coverage of a texture.
 *
 * @type {ShaderDesc}
 */
export const unlitShader = {
    uniqueName: 'gizmo-unlit',
    attributes: {
        vertex_position: SEMANTIC_POSITION,
        vertex_texCoord0: SEMANTIC_TEXCOORD0
    },
    vertexGLSL: /* glsl */`
        attribute vec3 vertex_position;
        #ifdef TEXTURE
            attribute vec2 vertex_texCoord0;
            varying vec2 vUv;
        #endif
    
        uniform mat4 matrix_model;
        uniform mat4 matrix_viewProjection;
    
        void main(void) {
            gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
            gl_Position.z = clamp(gl_Position.z, -abs(gl_Position.w), abs(gl_Position.w));
            #ifdef TEXTURE
                vUv = vertex_texCoord0;
            #endif
        }
    `,
    fragmentGLSL: /* glsl */`
        #include "gammaPS"
    
        precision highp float;
    
        uniform vec4 uColor;
        uniform float uDepth;
        #ifdef TEXTURE
            uniform sampler2D uTexture;
            varying vec2 vUv;
        #endif

        void main(void) {
            vec4 color = uColor;
            #ifdef TEXTURE
                // sharpen the filtered edges to a pixel wide, as geometry draws them
                float coverage = texture2D(uTexture, vUv).a;
                color.a *= clamp((coverage - 0.5) / max(fwidth(coverage), 1e-4) + 0.5, 0.0, 1.0);
            #endif
            if (color.a < 1.0 / 255.0) {
                discard;
            }
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(color)), color.a);
            #if DEPTH_WRITE == 1
                gl_FragDepth = uDepth;
            #endif
        }
    `,
    vertexWGSL: /* wgsl */`
        attribute vertex_position: vec3f;
        #ifdef TEXTURE
            attribute vertex_texCoord0: vec2f;
            varying vUv: vec2f;
        #endif

        uniform matrix_model: mat4x4f;
        uniform matrix_viewProjection: mat4x4f;

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            let pos = vec4f(input.vertex_position, 1.0);
            output.position = uniform.matrix_viewProjection * uniform.matrix_model * pos;
            output.position.z = clamp(output.position.z, -abs(output.position.w), abs(output.position.w));
            #ifdef TEXTURE
                output.vUv = input.vertex_texCoord0;
            #endif
            return output;
        }
    `,
    fragmentWGSL: /* wgsl */`
        #include "gammaPS"

        uniform uColor: vec4f;
        uniform uDepth: f32;
        #ifdef TEXTURE
            var uTexture: texture_2d<f32>;
            var uTextureSampler: sampler;
            varying vUv: vec2f;
        #endif

        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;
            var color = uniform.uColor;
            #ifdef TEXTURE
                // sharpen the filtered edges to a pixel wide, as geometry draws them
                let coverage = textureSample(uTexture, uTextureSampler, input.vUv).a;
                color.a *= clamp((coverage - 0.5) / max(fwidth(coverage), 1e-4) + 0.5, 0.0, 1.0);
            #endif
            if (color.a < 1.0 / 255.0) {
                discard;
            }
            output.color = vec4f(gammaCorrectOutput(decodeGamma(color)), color.a);
            #if DEPTH_WRITE == 1
                output.fragDepth = uniform.uDepth;
            #endif
            return output;
        }
    `
};

/**
 * The unlit shader of a line batch, one instance per line. The occluded pass defines OCCLUDED.
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
