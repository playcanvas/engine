import { SHADERLANGUAGE_WGSL } from '../constants.js';
import halfTypes from './frag/half-types.js';
import sharedWGSL from './frag/shared-wgsl.js';
import wgslFS from './frag/webgpu-wgsl.js';
import wgslVS from './vert/webgpu-wgsl.js';

/**
 * @import { ShaderChunkCollection } from '../shader-chunk-collection.js'
 */

/**
 * The platform chunks the WebGPU device adds to every WGSL vertex and fragment shader.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const webgpuChunksWGSL = {
    language: SHADERLANGUAGE_WGSL,
    chunks: {
        vertexHeader: wgslVS,
        fragmentHeader: wgslFS,
        shared: sharedWGSL,
        halfTypes
    }
};
