import { SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { ChunkUtils } from '../../scene/shader-lib/chunk-utils.js';

/**
 * @import { ShaderDesc } from '../../scene/materials/shader-material.js'
 */

const vertexGLSL = /* glsl */ `
    attribute vec2 vertex_position;
    uniform mat4 matrix_model;
    uniform float projectionFlipY;
    varying vec2 uv0;
    void main(void) {
        gl_Position = matrix_model * vec4(vertex_position, 0.0, 1.0);
        gl_Position.y *= projectionFlipY;
        uv0 = vertex_position + 0.5;
    }
`;

const vertexWGSL = /* wgsl */ `
    attribute vertex_position: vec2f;
    uniform matrix_model: mat4x4f;
    uniform projectionFlipY: f32;
    varying uv0: vec2f;
    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniform.matrix_model * vec4f(input.vertex_position, 0.0, 1.0);
        output.position.y *= uniform.projectionFlipY;
        output.uv0 = input.vertex_position + vec2f(0.5);
        return output;
    }
`;

/**
 * Builds shaders for one debug texture sampling mode.
 *
 * @param {string} mode - Filtered color, unfilterable color, raw depth, or scene depth.
 * @param {string} encoding - The source texture's encoding.
 * @returns {ShaderDesc} Shader description.
 * @ignore
 */
const createTextureShaderDesc = (mode, encoding) => {
    let fragmentGLSL;
    let fragmentWGSL;
    if (mode === 'scene-depth') {
        // Preview UVs start at the top. Scene depth follows the camera target's orientation,
        // including its projection flip and the graphics backend's native texture origin.
        fragmentGLSL = /* glsl */ `
            #include "screenDepthPS"
            #include "gammaPS"
            varying vec2 uv0;
            uniform float projectionFlipY;
            void main(void) {
                vec2 uv = vec2(uv0.x, 0.5 - (uv0.y - 0.5) * projectionFlipY);
                float depth = getLinearScreenDepth(getImageEffectUV(uv)) * camera_params.x;
                gl_FragColor = vec4(gammaCorrectOutput(vec3(depth)), 1.0);
            }
        `;
        fragmentWGSL = /* wgsl */ `
            #include "screenDepthPS"
            #include "gammaPS"
            varying uv0: vec2f;
            uniform projectionFlipY: f32;
            @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                var output: FragmentOutput;
                let uv = vec2f(input.uv0.x, 0.5 - (input.uv0.y - 0.5) * uniform.projectionFlipY);
                let depth = getLinearScreenDepth(getImageEffectUV(uv)) * uniform.camera_params.x;
                output.color = vec4f(gammaCorrectOutput(vec3f(depth)), 1.0);
                return output;
            }
        `;
    } else {
        const depth = mode === 'depth';
        const filtered = mode === 'filtered';
        const decode = ChunkUtils.decodeFunc(encoding);
        const raw = encoding === 'raw' || encoding === 'raw-srgb';
        const srgb = encoding === 'raw-srgb';
        // Hardware sampling decodes sRGB RGB channels. Undo that conversion before inspecting
        // stored values; alpha is unaffected. HDR encodings are deliberately not decoded here.
        fragmentGLSL = /* glsl */ `
            #include "gammaPS"
            varying vec2 uv0;
            uniform highp sampler2D colorMap;
            ${raw ? 'uniform ivec3 textureChannels;' : ''}
            void main(void) {
                ${filtered ? 'vec4 sampleColor = texture2D(colorMap, uv0);' : `
                    ivec2 size = textureSize(colorMap, 0);
                    ivec2 uv = clamp(ivec2(uv0 * vec2(size)), ivec2(0), size - 1);
                    vec4 sampleColor = texelFetch(colorMap, uv, 0);
                `}
                ${depth ? 'gl_FragColor = vec4(vec3(sampleColor.r), 1.0);' : raw ? `
                    ${srgb ? `
                        sampleColor.rgb = mix(1.055 * pow(sampleColor.rgb, vec3(1.0 / 2.4)) - 0.055,
                            sampleColor.rgb * 12.92, lessThanEqual(sampleColor.rgb, vec3(0.0031308)));
                    ` : ''}
                    gl_FragColor = vec4(sampleColor[textureChannels.x], sampleColor[textureChannels.y], sampleColor[textureChannels.z], 1.0);
                ` : `
                    gl_FragColor = vec4(gammaCorrectOutput(${decode}(sampleColor)), 1.0);
                `}
            }
        `;
        fragmentWGSL = /* wgsl */ `
            #include "gammaPS"
            varying uv0: vec2f;
            var colorMap: ${depth ? 'texture_depth_2d' : filtered ? 'texture_2d<f32>' : 'texture_2d<uff>'};
            ${filtered ? 'var colorMapSampler: sampler;' : ''}
            ${raw ? 'uniform textureChannels: vec3i;' : ''}
            @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                var output: FragmentOutput;
                ${filtered ? 'let sampleColor = textureSample(colorMap, colorMapSampler, input.uv0);' : `
                    let size = vec2i(textureDimensions(colorMap, 0));
                    let uv = clamp(vec2i(input.uv0 * vec2f(size)), vec2i(0), size - vec2i(1));
                    let sampleColor = textureLoad(colorMap, uv, 0);
                `}
                ${depth ? 'output.color = vec4f(vec3f(sampleColor), 1.0);' : raw ? `
                    ${srgb ? `
                        let storedRgb = select(1.055 * pow(sampleColor.rgb, vec3f(1.0 / 2.4)) - vec3f(0.055),
                            sampleColor.rgb * 12.92, sampleColor.rgb <= vec3f(0.0031308));
                        let storedColor = vec4f(storedRgb, sampleColor.a);
                    ` : 'let storedColor = sampleColor;'}
                    output.color = vec4f(storedColor[uniform.textureChannels.x], storedColor[uniform.textureChannels.y], storedColor[uniform.textureChannels.z], 1.0);
                ` : `
                    output.color = vec4f(gammaCorrectOutput(${decode}(sampleColor)), 1.0);
                `}
                return output;
            }
        `;
    }

    return {
        uniqueName: `TextureRenderer-${mode}-${encoding}`,
        attributes: { vertex_position: SEMANTIC_POSITION },
        vertexGLSL,
        vertexWGSL,
        fragmentGLSL,
        fragmentWGSL
    };
};

export { createTextureShaderDesc };
