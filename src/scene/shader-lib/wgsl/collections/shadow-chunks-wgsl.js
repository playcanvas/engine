import { SHADERLANGUAGE_WGSL } from '../../../../platform/graphics/constants.js';
import blurVSMPS from '../chunks/lit/frag/blurVSM.js';
import litShadowMainPS from '../chunks/lit/frag/pass-shadow/litShadowMain.js';
import shadowCasterPS from '../chunks/common/frag/shadow-caster.js';
import shadowEVSMPS from '../chunks/lit/frag/lighting/shadowEVSM.js';
import shadowEVSMExponentPS from '../chunks/common/frag/shadow-evsm-exponent.js';
import shadowPCF1PS from '../chunks/lit/frag/lighting/shadowPCF1.js';
import shadowPCF3PS from '../chunks/lit/frag/lighting/shadowPCF3.js';
import shadowPCF5PS from '../chunks/lit/frag/lighting/shadowPCF5.js';

/**
 * @import { ShaderChunkCollection } from '../../../../platform/graphics/shader-chunk-collection.js'
 */

/**
 * The WGSL shader chunks shared by the shadows of all light types: the shadow pass, shadow
 * casters, and the PCF and VSM sampling of shadow maps by lit materials.
 *
 * @type {ShaderChunkCollection}
 * @ignore
 */
export const shadowChunksWGSL = {
    name: 'shadows',
    language: SHADERLANGUAGE_WGSL,
    chunks: {
        blurVSMPS,
        litShadowMainPS,
        shadowCasterPS,
        shadowEVSMPS,
        shadowEVSMExponentPS,
        shadowPCF1PS,
        shadowPCF3PS,
        shadowPCF5PS
        // shadowPCSSPS: omni / spot PCSS is not supported on WebGPU currently, as this is only for
        // non-clustered lights
    }
};
