import { hashCode } from '../../core/hash.js';
import { GAMMA_SRGB, TONEMAP_LINEAR } from '../constants.js';

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
            const key = `${this.gammaCorrection}_${this.toneMapping}`;
            this._hash = hashCode(key);
        }
        return this._hash;
    }

    markDirty() {
        this._hash = undefined;
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
}

export { RenderingParams };
