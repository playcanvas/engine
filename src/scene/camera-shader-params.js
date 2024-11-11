import { hashCode } from '../core/hash.js';
import { FOG_NONE, GAMMA_NONE, GAMMA_SRGB, TONEMAP_LINEAR } from './constants.js';

/**
 * Internal camera shader parameters, used to generate and use matching shaders.
 *
 * @ignore
 */
class CameraShaderParams {
    /** @private */
    _gammaCorrection = GAMMA_SRGB;

    /** @private */
    _toneMapping = TONEMAP_LINEAR;

    /** @private */
    _srgbRenderTarget = false;

    /** @private */
    _ssaoEnabled = false;

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
            const key = `${this.gammaCorrection}_${this.toneMapping}_${this.srgbRenderTarget}_${this.fog}_${this.ssaoEnabled}`;
            this._hash = hashCode(key);
        }
        return this._hash;
    }

    initDefaults() {
        this._gammaCorrection = GAMMA_SRGB;
        this._toneMapping = TONEMAP_LINEAR;
        this._srgbRenderTarget = false;
        this._ssaoEnabled = false;
        this._fog = FOG_NONE;
    }

    markDirty() {
        this._hash = undefined;
    }

    set fog(type) {
        if (this._fog !== type) {
            this._fog = type;
            this.markDirty();
        }
    }

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

    set gammaCorrection(value) {
        this._gammaCorrectionAssigned = true;
        if (this._gammaCorrection !== value) {
            this._gammaCorrection = value;
            this.markDirty();
        }
    }

    get gammaCorrection() {
        return this._gammaCorrection;
    }

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

export { CameraShaderParams };
