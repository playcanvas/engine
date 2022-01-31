import {
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2,
    SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT
} from '../constants.js';
import { Shader } from '../shader.js';

import { shaderChunks } from './chunks/chunks.js';

import { dummyFragmentCode, precisionCode, versionCode } from './programs/common.js';

const attrib2Semantic = {
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

/* eslint-disable jsdoc/check-types */
/**
 * Extract the attributes specified in a vertex shader.
 *
 * @param {string} vsCode - The vertex shader code.
 * @returns {Object.<string, string>} The attribute name to semantic map.
 * @ignore
 */
function collectAttribs(vsCode) {
    const attribs = {};
    let attrs = 0;

    let found = vsCode.indexOf("attribute");
    while (found >= 0) {
        if (found > 0 && vsCode[found - 1] === "/") break;
        const endOfLine = vsCode.indexOf(';', found);
        const startOfAttribName = vsCode.lastIndexOf(' ', endOfLine);
        const attribName = vsCode.substr(startOfAttribName + 1, endOfLine - (startOfAttribName + 1));

        const semantic = attrib2Semantic[attribName];
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
/* eslint-enable jsdoc/check-types */

/**
 * Create a shader from named shader chunks.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {string} vsName - The vertex shader chunk name.
 * @param {string} psName - The fragment shader chunk name.
 * @param {boolean} [useTransformFeedback] - Whether to use transform feedback. Defaults to false.
 * @returns {Shader} The newly created shader.
 */
function createShader(device, vsName, psName, useTransformFeedback = false) {
    let vsCode = shaderChunks[vsName];
    let psCode = precisionCode(device) + "\n" + shaderChunks[psName];
    const attribs = collectAttribs(vsCode);

    if (device.webgl2) {
        vsCode = versionCode(device) + shaderChunks.gles3VS + vsCode;
        psCode = versionCode(device) + shaderChunks.gles3PS + psCode;
    }

    return new Shader(device, {
        attributes: attribs,
        vshader: vsCode,
        fshader: psCode,
        useTransformFeedback: useTransformFeedback
    });
}

/**
 * Create a shader from the supplied source code.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {string} vsCode - The vertex shader code.
 * @param {string} psCode - The fragment shader code.
 * @param {string} uName - Unique name for the shader.
 * @param {boolean} [useTransformFeedback] - Whether to use transform feedback. Defaults to false.
 * @param {string} [psPreamble] - An optional 'preamble' string for the fragment shader. Defaults
 * to ''.
 * @returns {Shader} The newly created shader.
 */
function createShaderFromCode(device, vsCode, psCode, uName, useTransformFeedback = false, psPreamble = "") {
    const shaderCache = device.programLib._cache;
    const cached = shaderCache[uName];
    if (cached !== undefined) return cached;

    psCode = precisionCode(device) + "\n" + (psCode || dummyFragmentCode());
    const attribs = collectAttribs(vsCode);

    if (device.webgl2) {
        vsCode = versionCode(device) + shaderChunks.gles3VS + vsCode;
        psCode = versionCode(device) + shaderChunks.gles3PS + psCode;
    }

    shaderCache[uName] = new Shader(device, {
        attributes: attribs,
        vshader: vsCode,
        fshader: psPreamble + psCode,
        useTransformFeedback: useTransformFeedback
    });
    return shaderCache[uName];
}

shaderChunks.collectAttribs = collectAttribs;
shaderChunks.createShader = createShader;
shaderChunks.createShaderFromCode = createShaderFromCode;

export { collectAttribs, createShader, createShaderFromCode };
