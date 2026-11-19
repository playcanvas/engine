import { SHADERLANGUAGE_GLSL } from '../../../../platform/graphics/constants.js';
import clusteredLightAreaPS from '../chunks/lit/frag/clusteredLightArea.js';
import ltcPS from '../chunks/lit/frag/ltc.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The GLSL shader chunks of area lights: the linearly transformed cosines evaluation of the area
 * light shapes, and its use by clustered lighting.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const areaLightChunksGLSL = {
    language: SHADERLANGUAGE_GLSL,
    chunks: {
        clusteredLightAreaPS,
        ltcPS
    }
};
