import { Debug } from "../../core/debug.js";
import {
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2,
    SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT
} from './constants.js';

import gles2FS from './shader-chunks/frag/gles2.js';
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
     * @param {string} [options.vertexDefines] - The vertex shader defines.
     * @param {string} [options.vertexExtensions] - The vertex shader extensions code.
     * @param {string} [options.fragmentCode] - The fragment shader code.
     * @param {string} [options.fragmentDefines] - The fragment shader defines.
     * @param {string} [options.fragmentExtensions] - The fragment shader extensions code.
     * @param {string} [options.fragmentPreamble] - The preamble string for the fragment shader.
     * @param {boolean} [options.useTransformFeedback] - Whether to use transform feedback. Defaults
     * to false.
     * @returns {object} Returns the created shader definition.
     */
    static createDefinition(device, options) {
        Debug.assert(options);

        const getDefines = (gpu, gl2, gl1, isVertex) => {

            const deviceIntro = device.isWebGPU ? gpu :
                (device.isWebGL2 ? gl2 : ShaderUtils.gl1Extensions(device, options) + gl1);

            // a define per supported color attachment, which strips out unsupported output definitions in the deviceIntro
            let attachmentsDefine = '';
            for (let i = 0; i < device.maxColorAttachments; i++) {
                attachmentsDefine += `#define COLOR_ATTACHMENT_${i}\n`;
            }

            return attachmentsDefine + deviceIntro;
        };

        const name = options.name ?? 'Untitled';

        // vertex code
        const vertDefines = options.vertexDefines || getDefines(webgpuVS, gles3VS, '', true);
        const vertCode = ShaderUtils.versionCode(device) +
            vertDefines +
            sharedFS +
            ShaderUtils.getShaderNameCode(name) +
            options.vertexCode;

        // fragment code
        const fragDefines = options.fragmentDefines || getDefines(webgpuFS, gles3FS, gles2FS, false);
        const fragCode = (options.fragmentPreamble || '') +
            ShaderUtils.versionCode(device) +
            fragDefines +
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
            fshader: fragCode,
            useTransformFeedback: options.useTransformFeedback
        };
    }

    // SpectorJS integration
    static getShaderNameCode(name) {
        return `#define SHADER_NAME ${name}\n`;
    }

    static gl1Extensions(device, options, isVertex) {
        let code;
        if (isVertex) {
            code = options.vertexExtensions ? `${options.vertexExtensions}\n` : '';
        } else {
            code = options.fragmentExtensions ? `${options.fragmentExtensions}\n` : '';

            // extensions used by default
            if (device.extStandardDerivatives) {
                code += "#extension GL_OES_standard_derivatives : enable\n";
            }
            if (device.extTextureLod) {
                code += "#extension GL_EXT_shader_texture_lod : enable\n";
                code += "#define SUPPORTS_TEXLOD\n";
            }
            if (device.extDrawBuffers) {
                code += "#extension GL_EXT_draw_buffers : require\n";
                code += "#define SUPPORTS_MRT\n";
            }
        }

        return code;
    }

    static dummyFragmentCode() {
        return "void main(void) {gl_FragColor = vec4(0.0);}";
    }

    static versionCode(device) {
        if (device.isWebGPU) {
            return '#version 450\n';
        }
        return device.isWebGL2 ? "#version 300 es\n" : "";
    }

    static precisionCode(device, forcePrecision) {

        let code = '';

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

        if (!device.isWebGPU) {

            code = `precision ${precision} float;\n`;

            if (device.isWebGL2) {
                code += `precision ${precision} sampler2DShadow;\n`;
            }

        } else { // WebGPU

            code = `precision ${precision} float;\nprecision ${precision} int;\n`;
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

            const semantic = _attrib2Semantic[attribName];
            if (semantic !== undefined) {
                attribs[attribName] = semantic;
            } else {
                attribs[attribName] = "ATTR" + attrs;
                attrs++;
            }

            found = vsCode.indexOf("attribute", found + 1);
        }

        return attribs;
    }
}

export { ShaderUtils };
