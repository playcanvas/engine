import { hashCode } from '../../core/hash.js';
import { Color } from '../../core/math/color.js';
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
    _ssaoEnabled = true;

    /** @private */
    _fog = FOG_NONE;

    /**
     * The color of the fog (if enabled), specified in sRGB color space. Defaults to black (0, 0, 0).
     *
     * @type {Color}
     */
    fogColor = new Color(0, 0, 0);

    /**
     * The density of the fog (if enabled). This property is only valid if the fog property is set
     * to {@link FOG_EXP} or {@link FOG_EXP2}. Defaults to 0.
     *
     * @type {number}
     */
    fogDensity = 0;

    /**
     * The distance from the viewpoint where linear fog reaches its maximum. This property is only
     * valid if the fog property is set to {@link FOG_LINEAR}. Defaults to 1000.
     *
     * @type {number}
     */
    fogEnd = 1000;

    /**
     * The distance from the viewpoint where linear fog begins. This property is only valid if the
     * fog property is set to {@link FOG_LINEAR}. Defaults to 1.
     *
     * @type {number}
     */
    fogStart = 1;

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
            const key = `${this.gammaCorrection}_${this.toneMapping}_${this.srgbRenderTarget}_${this.fog}_${this.ssaoEnabled}`;
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

    set ssaoEnabled(value) {
        if (this._ssaoEnabled !== value) {
            this._ssaoEnabled = value;
            this.markDirty();
        }
    }

    get ssaoEnabled() {
        return this._ssaoEnabled;
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
