import { SHADERLANGUAGE_GLSL } from '../../../../platform/graphics/constants.js';
import blurVSMPS from '../chunks/lit/frag/blurVSM.js';
import litShadowMainPS from '../chunks/lit/frag/pass-shadow/litShadowMain.js';
import shadowCascadesPS from '../chunks/lit/frag/lighting/shadowCascades.js';
import shadowCasterPS from '../chunks/common/frag/shadow-caster.js';
import shadowEVSMPS from '../chunks/lit/frag/lighting/shadowEVSM.js';
import shadowEVSMExponentPS from '../chunks/common/frag/shadow-evsm-exponent.js';
import shadowPCF1PS from '../chunks/lit/frag/lighting/shadowPCF1.js';
import shadowPCF3PS from '../chunks/lit/frag/lighting/shadowPCF3.js';
import shadowPCF5PS from '../chunks/lit/frag/lighting/shadowPCF5.js';
import shadowPCSSPS from '../chunks/lit/frag/lighting/shadowPCSS.js';
import shadowSoftPS from '../chunks/lit/frag/lighting/shadowSoft.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The GLSL shader chunks of shadow rendering: the shadow pass, shadow casters, and the sampling
 * of shadow maps by lit materials.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const shadowChunksGLSL = {
    name: 'shadows',
    language: SHADERLANGUAGE_GLSL,
    chunks: {
        blurVSMPS,
        litShadowMainPS,
        shadowCascadesPS,
        shadowCasterPS,
        shadowEVSMPS,
        shadowEVSMExponentPS,
        shadowPCF1PS,
        shadowPCF3PS,
        shadowPCF5PS,
        shadowPCSSPS,
        shadowSoftPS
    }
};
