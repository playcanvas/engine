import { SHADERLANGUAGE_GLSL } from '../../../../platform/graphics/constants.js';
import shadowSoftPS from '../chunks/lit/frag/lighting/shadowSoft.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The GLSL shader chunks of PCSS soft shadows of directional lights.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const directionalPcssChunksGLSL = {
    name: 'directionalPcss',
    language: SHADERLANGUAGE_GLSL,
    chunks: {
        shadowSoftPS
    }
};
