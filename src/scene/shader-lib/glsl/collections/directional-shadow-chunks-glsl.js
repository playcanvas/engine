import { SHADERLANGUAGE_GLSL } from '../../../../platform/graphics/constants.js';
import shadowCascadesPS from '../chunks/lit/frag/lighting/shadowCascades.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The GLSL shader chunks of the shadows of directional lights.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const directionalShadowChunksGLSL = {
    language: SHADERLANGUAGE_GLSL,
    chunks: {
        shadowCascadesPS
    }
};
