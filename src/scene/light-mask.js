import {
    MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE,
    SHADERDEF_AFFECT_DYNAMIC, SHADERDEF_AFFECT_LIGHTMAPPED, SHADERDEF_BAKE
} from './constants.js';

/**
 * Returns the shader define flags that hold a light mask in the shader defines of a mesh instance.
 *
 * @param {number} mask - The light mask, a combination of `MASK_AFFECT_DYNAMIC`,
 * `MASK_AFFECT_LIGHTMAPPED` and `MASK_BAKE`.
 * @returns {number} The matching `SHADERDEF_AFFECT_DYNAMIC`, `SHADERDEF_AFFECT_LIGHTMAPPED` and
 * `SHADERDEF_BAKE` flags.
 * @ignore
 */
const lightMaskToShaderDefs = mask => ((mask & MASK_AFFECT_DYNAMIC) ? SHADERDEF_AFFECT_DYNAMIC : 0) |
    ((mask & MASK_AFFECT_LIGHTMAPPED) ? SHADERDEF_AFFECT_LIGHTMAPPED : 0) |
    ((mask & MASK_BAKE) ? SHADERDEF_BAKE : 0);

/**
 * Returns the light mask held in the shader defines of a mesh instance.
 *
 * @param {number} shaderDefs - The shader defines.
 * @returns {number} The light mask, a combination of `MASK_AFFECT_DYNAMIC`,
 * `MASK_AFFECT_LIGHTMAPPED` and `MASK_BAKE`.
 * @ignore
 */
const shaderDefsToLightMask = shaderDefs => ((shaderDefs & SHADERDEF_AFFECT_DYNAMIC) ? MASK_AFFECT_DYNAMIC : 0) |
    ((shaderDefs & SHADERDEF_AFFECT_LIGHTMAPPED) ? MASK_AFFECT_LIGHTMAPPED : 0) |
    ((shaderDefs & SHADERDEF_BAKE) ? MASK_BAKE : 0);

export { lightMaskToShaderDefs, shaderDefsToLightMask };
