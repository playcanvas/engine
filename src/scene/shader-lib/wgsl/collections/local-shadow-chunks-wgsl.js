import { SHADERLANGUAGE_WGSL } from '../../../../platform/graphics/constants.js';
import clusteredLightShadowsPS from '../chunks/lit/frag/clusteredLightShadows.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The WGSL shader chunks of the shadows of local (omni and spot) lights: the shadows of clustered lights.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const localShadowChunksWGSL = {
    language: SHADERLANGUAGE_WGSL,
    chunks: {
        clusteredLightShadowsPS
    }
};
