import { SHADERLANGUAGE_WGSL } from '../../../../platform/graphics/constants.js';
import clusteredLightAreaPS from '../chunks/lit/frag/clusteredLightArea.js';
import ltcPS from '../chunks/lit/frag/ltc.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The WGSL shader chunks of area lights: the linearly transformed cosines evaluation of the area
 * light shapes, and its use by clustered lighting.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const areaLightChunksWGSL = {
    language: SHADERLANGUAGE_WGSL,
    chunks: {
        clusteredLightAreaPS,
        ltcPS
    }
};
