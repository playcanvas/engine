import { Debug } from '../core/debug.js';
import {
    SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_DEPTH, SHADER_PICK,
    SHADER_SHADOW, SHADOW_COUNT, LIGHTTYPE_COUNT
} from './constants.js';
import {
    PASSTYPE_FORWARD, PASSTYPE_DEPTH, PASSTYPE_PICK, PASSTYPE_SHADOW
} from '../graphics/constants.js';

/**
 * A pure static utility class, responsible for math operations on the shader pass constants.
 *
 * @ignore
 */
class ShaderPass {
    /**
     * Returns true if the shader pass is a shadow shader pass.
     *
     * @param {number} shaderPass - The shader pass.
     * @returns {string} - True if the pass is a shadow shader pass.
     */
    static getPassType(shaderPass) {
        switch (shaderPass) {
            case SHADER_FORWARD:
            case SHADER_FORWARDHDR:
                return PASSTYPE_FORWARD;
            case SHADER_DEPTH:
                return PASSTYPE_DEPTH;
            case SHADER_PICK:
                return PASSTYPE_PICK;
            default:
                return (shaderPass >= SHADER_SHADOW && shaderPass < SHADER_SHADOW + SHADOW_COUNT * LIGHTTYPE_COUNT) ? PASSTYPE_SHADOW : PASSTYPE_FORWARD;
        }
    }

    /**
     * Returns true if the shader pass is a forward shader pass.
     *
     * @param {number} pass - The shader pass.
     * @returns {boolean} - True if the pass is a forward shader pass.
     */
    static isForward(pass) {
        return this.getPassType(pass) === PASSTYPE_FORWARD;
    }

    /**
     * Returns true if the shader pass is a shadow shader pass.
     *
     * @param {number} pass - The shader pass.
     * @returns {boolean} - True if the pass is a shadow shader pass.
     */
    static isShadow(pass) {
        return this.getPassType(pass) === PASSTYPE_SHADOW;
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
     * Returns a shader pass for specified light and shadow type.
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
