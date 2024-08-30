import { hashCode } from '../../core/hash.js';
import { FOG_NONE, GAMMA_NONE, GAMMA_SRGB, TONEMAP_LINEAR } from '../constants.js';

/**
 * Rendering parameters, allow configuration of the rendering parameters.
 *
 * @category Graphics
 */
class RenderingParams {
    /** @private */
    _gammaCorrection = GAMMA_SRGB;

    /** @private */
    _toneMapping = TONEMAP_LINEAR;

    /** @private */
    _srgbRenderTarget = false;

    /** @private */
    _fog = FOG_NONE;

    /**
     * The hash of the rendering parameters, or undefined if the hash has not been computed yet.
     *
     * @type {number|undefined}
     * @private
     */
    _hash;

    /**
     * The hash of the rendering parameters.
     *
     * @type {number}
     * @ignore
     */
    get hash() {
        if (this._hash === undefined) {
            const key = `${this.gammaCorrection}_${this.toneMapping}_${this.srgbRenderTarget}_${this.fog}`;
            this._hash = hashCode(key);
        }
        return this._hash;
    }

    markDirty() {
        this._hash = undefined;
    }

    /**
     * Sets the type of fog used by the scene. Can be:
     *
     * - {@link FOG_NONE}
     * - {@link FOG_LINEAR}
     * - {@link FOG_EXP}
     * - {@link FOG_EXP2}
     *
     * Defaults to {@link FOG_NONE}.
     *
     * @type {string}
     */
    set fog(type) {
        if (this._fog !== type) {
            this._fog = type;
            this.markDirty();
        }
    }

    /**
     * Gets the type of fog used by the scene.
     *
     * @type {string}
     */
    get fog() {
        return this._fog;
    }

    /**
     * The gamma correction to apply when rendering the scene. Can be:
     *
     * - {@link GAMMA_NONE}
     * - {@link GAMMA_SRGB}
     *
     * Defaults to {@link GAMMA_SRGB}.
     *
     * @type {number}
     */
    set gammaCorrection(value) {
        if (this._gammaCorrection !== value) {
            this._gammaCorrection = value;
            this.markDirty();
        }
    }

    get gammaCorrection() {
        return this._gammaCorrection;
    }

    /**
     * The tonemapping transform to apply to the rendered color buffer. Can be:
     *
     * - {@link TONEMAP_LINEAR}
     * - {@link TONEMAP_FILMIC}
     * - {@link TONEMAP_HEJL}
     * - {@link TONEMAP_ACES}
     * - {@link TONEMAP_ACES2}
     * - {@link TONEMAP_NEUTRAL}
     *
     * Defaults to {@link TONEMAP_LINEAR}.
     *
     * @type {number}
     */
    set toneMapping(value) {
        if (this._toneMapping !== value) {
            this._toneMapping = value;
            this.markDirty();
        }
    }

    get toneMapping() {
        return this._toneMapping;
    }

    set srgbRenderTarget(value) {
        if (this._srgbRenderTarget !== value) {
            this._srgbRenderTarget = value;
            this.markDirty();
        }
    }

    get srgbRenderTarget() {
        return this._srgbRenderTarget;
    }

    /**
     * Returns {@link GAMMA_SRGB} if the shader code needs to output gamma corrected color, otherwise
     * returns {@link GAMMA_NONE}.
     *
     * @type {number}
     * @ignore
     */
    get shaderOutputGamma() {
        // if gamma rendering is enabled, but the render target does not have sRGB format,
        // the shader needs to do the linear -> gamma conversion
        const gammaOutput = this._gammaCorrection === GAMMA_SRGB && !this._srgbRenderTarget;
        return gammaOutput ? GAMMA_SRGB : GAMMA_NONE;
    }
}

export { RenderingParams };
