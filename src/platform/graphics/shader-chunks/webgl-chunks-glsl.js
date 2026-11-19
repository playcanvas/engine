import { SHADERLANGUAGE_GLSL } from '../constants.js';
import gles3FS from './frag/gles3.js';
import sharedGLSL from './frag/shared.js';
import gles3VS from './vert/gles3.js';

/**
 * @import { ShaderChunkCollection } from '../shader-chunk-collection.js'
 */

/**
 * The platform chunks the WebGL device adds to every GLSL shader.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const webglChunksGLSL = {
    language: SHADERLANGUAGE_GLSL,
    chunks: {
        vertexHeader: gles3VS,
        fragmentHeader: gles3FS,
        shared: sharedGLSL
    }
};
