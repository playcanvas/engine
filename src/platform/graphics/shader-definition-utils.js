import { Debug } from '../../core/debug.js';
import {
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2,
    SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT,
    SHADERLANGUAGE_WGSL,
    SHADERLANGUAGE_GLSL,
    primitiveGlslToWgslTypeMap
} from './constants.js';
import gles3FS from './shader-chunks/frag/gles3.js';
import gles3VS from './shader-chunks/vert/gles3.js';
import webgpuFS from './shader-chunks/frag/webgpu.js';
import webgpuVS from './shader-chunks/vert/webgpu.js';
import wgslFS from './shader-chunks/frag/webgpu-wgsl.js';
import wgslVS from './shader-chunks/vert/webgpu-wgsl.js';
import sharedGLSL from './shader-chunks/frag/shared.js';
import sharedWGSL from './shader-chunks/frag/shared-wgsl.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 */

const _attrib2Semantic = {
    vertex_position: SEMANTIC_POSITION,
    vertex_normal: SEMANTIC_NORMAL,
    vertex_tangent: SEMANTIC_TANGENT,
    vertex_texCoord0: SEMANTIC_TEXCOORD0,
    vertex_texCoord1: SEMANTIC_TEXCOORD1,
    vertex_texCoord2: SEMANTIC_TEXCOORD2,
    vertex_texCoord3: SEMANTIC_TEXCOORD3,
    vertex_texCoord4: SEMANTIC_TEXCOORD4,
    vertex_texCoord5: SEMANTIC_TEXCOORD5,
    vertex_texCoord6: SEMANTIC_TEXCOORD6,
    vertex_texCoord7: SEMANTIC_TEXCOORD7,
    vertex_color: SEMANTIC_COLOR,
    vertex_boneIndices: SEMANTIC_BLENDINDICES,
    vertex_boneWeights: SEMANTIC_BLENDWEIGHT
};

/**
 * A class providing utility functions for shader definition creation.
 *
 * @ignore
 */
class ShaderDefinitionUtils {
    /**
     * Creates a shader definition.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} options - Object for passing optional arguments.
     * @param {string} [options.name] - A name of the shader.
     * @param {object} [options.attributes] - Attributes. Will be extracted from the vertexCode if
     * not provided.
     * @param {string} options.vertexCode - The vertex shader code.
     * @param {string} [options.fragmentCode] - The fragment shader code.
     * @param {string} [options.fragmentPreamble] - The preamble string for the fragment shader.
     * @param {string[]} [options.feedbackVaryings] - A list of shader output variable
     * names that will be captured when using transform feedback. This setting is only effective
     * if the useTransformFeedback property is enabled.
     * @param {boolean} [options.useTransformFeedback] - Whether to use transform feedback. Defaults
     * to false.
     * @param {Map<string, string>} [options.vertexIncludes] - A map containing key-value pairs of
     * include names and their content. These are used for resolving #include directives in the
     * vertex shader source.
     * @param {Map<string, string>} [options.vertexDefines] - A map containing key-value pairs of
     * define names and their values. These are used for resolving #ifdef style of directives in the
     * vertex code.
     * @param {Map<string, string>} [options.fragmentIncludes] - A map containing key-value pairs
     * of include names and their content. These are used for resolving #include directives in the
     * fragment shader source.
     * @param {Map<string, string>} [options.fragmentDefines] - A map containing key-value pairs of
     * define names and their values. These are used for resolving #ifdef style of directives in the
     * fragment code.
     * @param {string | string[]} [options.fragmentOutputTypes] - Fragment shader output types,
     * which default to vec4. Passing a string will set the output type for all color attachments.
     * Passing an array will set the output type for each color attachment.
     * @returns {object} Returns the created shader definition.
     */
    static createDefinition(device, options) {
        Debug.assert(options);
        Debug.assert(!options.vertexDefines || options.vertexDefines instanceof Map);
        Debug.assert(!options.vertexIncludes || options.vertexIncludes instanceof Map);
        Debug.assert(!options.fragmentDefines || options.fragmentDefines instanceof Map);
        Debug.assert(!options.fragmentIncludes || options.fragmentIncludes instanceof Map);

        // Normalize fragmentOutputTypes to an array
        const normalizedOutputTypes = (options) => {
            let fragmentOutputTypes = options.fragmentOutputTypes ?? 'vec4';
            if (!Array.isArray(fragmentOutputTypes)) {
                fragmentOutputTypes = [fragmentOutputTypes];
            }
            return fragmentOutputTypes;
        };

        const getDefines = (gpu, gl2, isVertex, options) => {

            const deviceIntro = device.isWebGPU ? gpu : gl2;

            // a define per supported color attachment, which strips out unsupported output definitions in the deviceIntro
            let attachmentsDefine = '';

            // Define the fragment shader output type, vec4 by default
            if (!isVertex) {
                const fragmentOutputTypes = normalizedOutputTypes(options);

                for (let i = 0; i < device.maxColorAttachments; i++) {
                    attachmentsDefine += `#define COLOR_ATTACHMENT_${i}\n`;
                    const outType = fragmentOutputTypes[i] ?? 'vec4';
                    attachmentsDefine += `#define outType_${i} ${outType}\n`;
                }
            }

            return attachmentsDefine + deviceIntro;
        };

        const getDefinesWgsl = (isVertex, options) => {

            let attachmentsDefine = '';

            // Define the fragment shader output type, vec4 by default
            if (!isVertex) {
                const fragmentOutputTypes = normalizedOutputTypes(options);

                // create alias for each output type
                for (let i = 0; i < device.maxColorAttachments; i++) {
                    const glslOutType = fragmentOutputTypes[i] ?? 'vec4';
                    const wgslOutType = primitiveGlslToWgslTypeMap.get(glslOutType);
                    Debug.assert(wgslOutType, `Unknown output type translation: ${glslOutType} -> ${wgslOutType}`);
                    attachmentsDefine += `alias pcOutType${i} = ${wgslOutType};\n`;
                }
            }

            return attachmentsDefine;
        };

        const name = options.name ?? 'Untitled';
        let vertCode;
        let fragCode;

        const vertexDefinesCode = ShaderDefinitionUtils.getDefinesCode(device, options.vertexDefines);
        const fragmentDefinesCode = ShaderDefinitionUtils.getDefinesCode(device, options.fragmentDefines);
        const wgsl = options.shaderLanguage === SHADERLANGUAGE_WGSL;

        if (wgsl) {

            vertCode = `
                ${getDefinesWgsl(true, options)}
                ${wgslVS}
                ${sharedWGSL}
                ${vertexDefinesCode}
                ${options.vertexCode}
            `;

            fragCode = `
                ${getDefinesWgsl(false, options)}
                ${wgslFS}
                ${sharedWGSL}
                ${fragmentDefinesCode}
                ${options.fragmentCode}
            `;

        } else {

            Debug.assert(options.vertexCode);

            // vertex code
            vertCode = `${ShaderDefinitionUtils.versionCode(device) +
                getDefines(webgpuVS, gles3VS, true, options) +
                vertexDefinesCode +
                ShaderDefinitionUtils.precisionCode(device)}
                ${sharedGLSL}
                ${ShaderDefinitionUtils.getShaderNameCode(name)}
                ${options.vertexCode}`;

            Debug.assert(options.fragmentCode);

            // fragment code
            fragCode = `${(options.fragmentPreamble || '') +
                ShaderDefinitionUtils.versionCode(device) +
                getDefines(webgpuFS, gles3FS, false, options) +
                fragmentDefinesCode +
                ShaderDefinitionUtils.precisionCode(device)}
                ${sharedGLSL}
                ${ShaderDefinitionUtils.getShaderNameCode(name)}
                ${options.fragmentCode}`;
        }

        return {
            name: name,
            shaderLanguage: options.shaderLanguage ?? SHADERLANGUAGE_GLSL,
            attributes: options.attributes,
            vshader: vertCode,
            vincludes: options.vertexIncludes,
            fincludes: options.fragmentIncludes,
            fshader: fragCode,
            feedbackVaryings: options.feedbackVaryings,
            useTransformFeedback: options.useTransformFeedback,
            meshUniformBufferFormat: options.meshUniformBufferFormat,
            meshBindGroupFormat: options.meshBindGroupFormat
        };
    }

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Map<string, string>} [defines] - A map containing key-value pairs.
     * @returns {string} The shader code for the defines.
     * @ignore
     */
    static getDefinesCode(device, defines) {
        let code = '';

        device.capsDefines.forEach((value, key) => {
            code += `#define ${key} ${value}\n`;
        });
        code += '\n';

        defines?.forEach((value, key) => {
            code += `#define ${key} ${value}\n`;
        });
        code += '\n';

        return code;
    }

    // SpectorJS integration
    static getShaderNameCode(name) {
        return `#define SHADER_NAME ${name}\n`;
    }

    static versionCode(device) {
        return device.isWebGPU ? '#version 450\n' : '#version 300 es\n';
    }

    static precisionCode(device, forcePrecision) {

        if (forcePrecision && forcePrecision !== 'highp' && forcePrecision !== 'mediump' && forcePrecision !== 'lowp') {
            forcePrecision = null;
        }

        if (forcePrecision) {
            if (forcePrecision === 'highp' && device.maxPrecision !== 'highp') {
                forcePrecision = 'mediump';
            }
            if (forcePrecision === 'mediump' && device.maxPrecision === 'lowp') {
                forcePrecision = 'lowp';
            }
        }

        const precision = forcePrecision ? forcePrecision : device.precision;

        const code = `
            precision ${precision} float;
            precision ${precision} int;
            precision ${precision} usampler2D;
            precision ${precision} isampler2D;
            precision ${precision} sampler2DShadow;
            precision ${precision} samplerCubeShadow;
            precision ${precision} sampler2DArray;
        `;

        return code;
    }

    /**
     * Extract the attributes specified in a vertex shader.
     *
     * @param {string} vsCode - The vertex shader code.
     * @returns {Object<string, string>} The attribute name to semantic map.
     * @ignore
     */
    static collectAttributes(vsCode) {
        const attribs = {};
        let attrs = 0;

        let found = vsCode.indexOf('attribute');
        while (found >= 0) {
            if (found > 0 && vsCode[found - 1] === '/') break;

            // skip the 'attribute' word inside the #define which we add to the shader
            let ignore = false;
            if (found > 0) {
                let startOfLine = vsCode.lastIndexOf('\n', found);
                startOfLine = startOfLine !== -1 ? startOfLine + 1 : 0;
                const lineStartString = vsCode.substring(startOfLine, found);
                if (lineStartString.includes('#')) {
                    ignore = true;
                }
            }

            if (!ignore) {
                const endOfLine = vsCode.indexOf(';', found);
                const startOfAttribName = vsCode.lastIndexOf(' ', endOfLine);
                const attribName = vsCode.substring(startOfAttribName + 1, endOfLine);

                // if the attribute already exists in the semantic map
                if (attribs[attribName]) {
                    Debug.warn(`Attribute [${attribName}] already exists when extracting the attributes from the vertex shader, ignoring.`, { vsCode });
                } else {
                    const semantic = _attrib2Semantic[attribName];
                    if (semantic !== undefined) {
                        attribs[attribName] = semantic;
                    } else {
                        attribs[attribName] = `ATTR${attrs}`;
                        attrs++;
                    }
                }
            }

            found = vsCode.indexOf('attribute', found + 1);
        }

        return attribs;
    }
}

export { ShaderDefinitionUtils };
