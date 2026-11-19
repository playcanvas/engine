import { SHADERLANGUAGE_GLSL } from '../../../../platform/graphics/constants.js';
import clusteredLightShadowsPS from '../chunks/lit/frag/clusteredLightShadows.js';
import shadowPCSSPS from '../chunks/lit/frag/lighting/shadowPCSS.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The GLSL shader chunks of the shadows of local (omni and spot) lights: the shadows of clustered lights, and the PCSS
 * shadows of non-clustered spot and omni lights.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const localShadowChunksGLSL = {
    language: SHADERLANGUAGE_GLSL,
    chunks: {
        clusteredLightShadowsPS,
        shadowPCSSPS
    }
};
