import { SHADERLANGUAGE_GLSL } from '../constants.js';
import sharedGLSL from './frag/shared.js';
import webgpuFS from './frag/webgpu.js';
import webgpuVS from './vert/webgpu.js';

/**
 * @import { ShaderChunkCollection } from '../shader-chunk-collection.js'
 */

/**
 * The platform chunks the WebGPU device adds to every GLSL shader, which it translates to WGSL.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const webgpuChunksGLSL = {
    language: SHADERLANGUAGE_GLSL,
    chunks: {
        vertexHeader: webgpuVS,
        fragmentHeader: webgpuFS,
        shared: sharedGLSL
    }
};
