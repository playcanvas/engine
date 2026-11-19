import { SHADERLANGUAGE_WGSL } from '../../../../platform/graphics/constants.js';
import shadowSoftPS from '../chunks/lit/frag/lighting/shadowSoft.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The WGSL shader chunks of PCSS soft shadows of directional lights.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const directionalPcssChunksWGSL = {
    name: 'directionalPcss',
    language: SHADERLANGUAGE_WGSL,
    chunks: {
        shadowSoftPS
    }
};
