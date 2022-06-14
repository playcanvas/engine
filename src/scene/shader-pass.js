import { Debug } from '../core/debug.js';
import { SHADER_SHADOW, SHADOW_COUNT, LIGHTTYPE_COUNT } from './constants.js';

/**
 * A pure static utility class, responsible for math operations on the shader pass constants.
 *
 * @ignore
 */
class ShaderPass {
    /**
     * Rturns true if the shader pass is a shadow shader pass.
     *
     * @param {number} pass - The shader pass.
     * @returns {boolean} - True if the pass is a shadow shader pass.
     */
    static isShadow(pass) {
        return pass >= SHADER_SHADOW && pass < SHADER_SHADOW + SHADOW_COUNT * LIGHTTYPE_COUNT;
    }

    /**
     * Returns the light type based on the shader shadow pass.
     *
     * @param {number} pass - The shader pass.
     * @returns {number} - A light type.
     */
    static toLightType(pass) {
        Debug.assert(ShaderPass.isShadow(pass));
        const shadowMode = pass - SHADER_SHADOW;
        return Math.floor(shadowMode / SHADOW_COUNT);
    }

    /**
     * Returns the shadow type based on the shader shadow pass.
     *
     * @param {number} pass - The shader pass.
     * @returns {number} - A shadow type.
     */
    static toShadowType(pass) {
        Debug.assert(ShaderPass.isShadow(pass));
        const shadowMode = pass - SHADER_SHADOW;
        const lightType = Math.floor(shadowMode / SHADOW_COUNT);
        return shadowMode - lightType * SHADOW_COUNT;
    }

    /**
     * Returns a shader pass for specified light and shadow types.
     *
     * @param {number} lightType - A light type.
     * @param {number} shadowType - A shadow type.
     * @returns {number} - A shader pass.
     */
    static getShadow(lightType, shadowType) {
        const shadowMode = shadowType + lightType * SHADOW_COUNT;
        const pass = SHADER_SHADOW + shadowMode;
        Debug.assert(ShaderPass.isShadow(pass));
        return pass;
    }
}

export { ShaderPass };
