import { SHADERLANGUAGE_WGSL } from '../../../../platform/graphics/constants.js';
import shadowCascadesPS from '../chunks/lit/frag/lighting/shadowCascades.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The WGSL shader chunks of the shadows of directional lights.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const directionalShadowChunksWGSL = {
    language: SHADERLANGUAGE_WGSL,
    chunks: {
        shadowCascadesPS
    }
};
