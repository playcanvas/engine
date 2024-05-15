import { Debug } from "../../core/debug.js";
import {
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2,
    SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT
} from './constants.js';

import gles3FS from './shader-chunks/frag/gles3.js';
import gles3VS from './shader-chunks/vert/gles3.js';
import webgpuFS from './shader-chunks/frag/webgpu.js';
import webgpuVS from './shader-chunks/vert/webgpu.js';
import sharedFS from './shader-chunks/frag/shared.js';

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
 * A class providing utility functions for shader creation.
 *
 * @ignore
 */
class ShaderUtils {
    /**
     * Creates a shader definition.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {object} options - Object for passing optional arguments.
     * @param {string} [options.name] - A name of the shader.
     * @param {object} [options.attributes] - Attributes. Will be extracted from the vertexCode if
     * not provided.
     * @param {string} options.vertexCode - The vertex shader code.
     * @param {string} [options.vertexExtensions] - The vertex shader extensions code.
     * @param {string} [options.fragmentCode] - The fragment shader code.
     * @param {string} [options.fragmentExtensions] - The fragment shader extensions code.
     * @param {string} [options.fragmentPreamble] - The preamble string for the fragment shader.
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

        const getDefines = (gpu, gl2, isVertex, options) => {

            const deviceIntro = device.isWebGPU ? gpu : gl2;

            // a define per supported color attachment, which strips out unsupported output definitions in the deviceIntro
            let attachmentsDefine = '';

            // Define the fragment shader output type, vec4 by default
            if (!isVertex) {
                // Normalize fragmentOutputTypes to an array
                let fragmentOutputTypes = options.fragmentOutputTypes ?? 'vec4';
                if (!Array.isArray(fragmentOutputTypes)) {
                    fragmentOutputTypes = [fragmentOutputTypes];
                }

                for (let i = 0; i < device.maxColorAttachments; i++) {
                    attachmentsDefine += `#define COLOR_ATTACHMENT_${i}\n`;
                    const outType = fragmentOutputTypes[i] ?? 'vec4';
                    attachmentsDefine += `#define outType_${i} ${outType}\n`;
                }
            }

            return attachmentsDefine + deviceIntro;
        };

        const name = options.name ?? 'Untitled';

        // vertex code
        const vertCode = ShaderUtils.versionCode(device) +
            getDefines(webgpuVS, gles3VS, true, options) +
            ShaderUtils.getDefinesCode(options.vertexDefines) +
            sharedFS +
            ShaderUtils.getShaderNameCode(name) +
            options.vertexCode;

        // fragment code
        const fragCode = (options.fragmentPreamble || '') +
            ShaderUtils.versionCode(device) +
            getDefines(webgpuFS, gles3FS, false, options) +
            ShaderUtils.getDefinesCode(options.fragmentDefines) +
            ShaderUtils.precisionCode(device) + '\n' +
            sharedFS +
            ShaderUtils.getShaderNameCode(name) +
            (options.fragmentCode || ShaderUtils.dummyFragmentCode());

        // attributes
        const attribs = options.attributes ?? ShaderUtils.collectAttributes(options.vertexCode);

        return {
            name: name,
            attributes: attribs,
            vshader: vertCode,
            vincludes: options.vertexIncludes,
            fincludes: options.fragmentIncludes,
            fshader: fragCode,
            useTransformFeedback: options.useTransformFeedback
        };
    }

    /**
     * @param {Map<string, string>} [defines] - A map containing key-value pairs.
     * @returns {string} The shader code for the defines.
     * @private
     */
    static getDefinesCode(defines) {
        let code = '';
        defines?.forEach((value, key) => {
            code += `#define ${key} ${value}\n`;
        });
        return code;
    }

    // SpectorJS integration
    static getShaderNameCode(name) {
        return `#define SHADER_NAME ${name}\n`;
    }

    static dummyFragmentCode() {
        return "void main(void) {gl_FragColor = vec4(0.0);}";
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

        let code = `precision ${precision} float;\nprecision ${precision} int;\n`;

        if (device.isWebGL2) {
            code += `precision ${precision} sampler2DShadow;\n`;
        }

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

        let found = vsCode.indexOf("attribute");
        while (found >= 0) {
            if (found > 0 && vsCode[found - 1] === "/") break;
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
                    attribs[attribName] = "ATTR" + attrs;
                    attrs++;
                }
            }

            found = vsCode.indexOf("attribute", found + 1);
        }

        return attribs;
    }
}

export { ShaderUtils };
