import { Debug } from "../../core/debug.js";
import { Shader } from "./shader.js";
import {
    DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2,
    SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT
} from './constants.js';

import gles2FS from './shader-chunks/frag/gles2.js';
import gles3FS from './shader-chunks/frag/gles3.js';
import gles3VS from './shader-chunks/vert/gles3.js';
import webgpuFS from './shader-chunks/frag/webgpu.js';
import webgpuVS from './shader-chunks/vert/webgpu.js';

/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */

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
     * Creates a new shader.
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} options - Object for passing optional arguments.
     * @param {string} options.name - A name of the shader.
     * @param {string} options.vertexCode - The vertex shader code.
     * @param {string} [options.vertexDefines] - The vertex shader defines.
     * @param {string} options.fragmentCode - The fragment shader code.
     * @param {string} [options.fragmentDefines] - The fragment shader defines.
     * @param {string} [options.fragmentPreamble] - The preamble string for the fragment shader.
     * @param {boolean} [options.useTransformFeedback] - Whether to use transform feedback. Defaults to false.
     * @returns {Shader} Returns the created shader.
     */
    static createShader(device, options) {
        Debug.assert(options);

        const getDefines = (gpu, gl2, gl1) => {
            return device.deviceType === DEVICETYPE_WEBGPU ? gpu :
                (device.webgl2 ? gl2 : gl1);
        };

        const name = options.name ?? 'Untitled';

        // vertex code
        const vertDefines = options.vertexDefines || getDefines(webgpuVS, gles3VS, '');
        const vertCode = ShaderUtils.versionCode(device) +
            vertDefines +
            ShaderUtils.getShaderNameCode(name) +
            options.vertexCode;

        // fragment code
        const fragDefines = options.fragmentDefines || getDefines(webgpuFS, gles3FS, gles2FS);
        const fragCode = (options.fragmentPreamble || '') +
        ShaderUtils.versionCode(device) +
            ShaderUtils.precisionCode(device) + '\n' +
            fragDefines +
            ShaderUtils.getShaderNameCode(name) +
            (options.fragmentCode || ShaderUtils.dummyFragmentCode);

        // attributes
        Debug.assert(options.vertexCode);
        const attribs = ShaderUtils.collectAttributes(options.vertexCode);

        return new Shader(device, {
            name: name,
            attributes: attribs,
            vshader: vertCode,
            fshader: fragCode,
            useTransformFeedback: options.useTransformFeedback
        });
    }

    // SpectorJS integration
    static getShaderNameCode(name) {
        return `#define SHADER_NAME ${name}\n`;
    }

    static dummyFragmentCode() {
        return "void main(void) {gl_FragColor = vec4(0.0);}";
    }

    static versionCode(device) {
        if (device.deviceType === DEVICETYPE_WEBGPU) {
            return '#version 450\n';
        }
        return device.webgl2 ? "#version 300 es\n" : "";
    }

    static precisionCode(device, forcePrecision, shadowPrecision) {

        let code = '';

        if (device.deviceType === DEVICETYPE_WEBGL) {

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
            code = `precision ${precision} float;\n`;

            // TODO: this can be only set on shaders with version 300 or more, so make this optional as many
            // internal shaders (particles..) are from webgl1 era and don't set any precision. Modified when upgraded.
            if (shadowPrecision && device.webgl2) {
                code += `precision ${precision} sampler2DShadow;\n`;
            }
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
