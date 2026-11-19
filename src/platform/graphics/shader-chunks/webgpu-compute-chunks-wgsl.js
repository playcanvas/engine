import { SHADERLANGUAGE_WGSL } from '../constants.js';
import dispatchThreadsCS from './compute/dispatch-threads.js';
import sceneColorCS from './compute/scene-color.js';
import sceneDepthCS from './compute/scene-depth.js';
import halfTypes from './frag/half-types.js';

/**
 * @import { ShaderChunkCollection } from '../shader-chunk-collection.js'
 */

/**
 * The built-in includes every compute shader can use, keyed by include name. A compute shader's own
 * includes of the same name take precedence.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const webgpuComputeChunksWGSL = {
    language: SHADERLANGUAGE_WGSL,
    chunks: {
        halfTypesCS: halfTypes,
        sceneDepthCS,
        sceneColorCS,
        dispatchThreadsCS
    }
};
