import { hashCode } from '../core/hash.js';
import { FOG_NONE, GAMMA_NONE, GAMMA_SRGB, gammaNames, TONEMAP_LINEAR, tonemapNames } from './constants.js';

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

    /** @private */
    _sceneDepthMapLinear = false;

    /**
     * True when each depth in the linear scene depth map is stored as a float bit-packed into an
     * RGBA8 texel, the encoding the producer of the map falls back to when float textures cannot be
     * rendered to. Only meaningful when {@link CameraShaderParams#sceneDepthMapLinear} is set.
     *
     * @private
     */
    _sceneDepthMapPacked = false;

    /**
     * The hash of the rendering parameters, or undefined if the hash has not been computed yet.
     *
     * @type {number|undefined}
     * @private
     */
    _hash;

    /**
     * Content of this class relevant to shader generation, which is supplied as defines for the
     * shader.
     *
     * @type {Map<string, string>}
     * @private
     */
    _defines = new Map();

    _definesDirty = true;

    /**
     * The hash of the rendering parameters.
     *
     * @type {number}
     * @ignore
     */
    get hash() {
        if (this._hash === undefined) {
            const key = `${this.gammaCorrection}_${this.toneMapping}_${this.srgbRenderTarget}_${this.fog}_${this.ssaoEnabled}_${this.sceneDepthMapLinear}_${this.sceneDepthMapPacked}`;
            this._hash = hashCode(key);
        }
        return this._hash;
    }

    get defines() {

        const defines = this._defines;

        if (this._definesDirty) {
            this._definesDirty = false;
            defines.clear();

            if (this._sceneDepthMapLinear) {
                defines.set('SCENE_DEPTHMAP_LINEAR', '');

                // nested, so that the packed define never appears without the linear one, which is
                // what the decode in the screenDepth chunk relies on
                if (this._sceneDepthMapPacked) defines.set('SCENE_DEPTHMAP_PACKED', '');
            }
            if (this.shaderOutputGamma === GAMMA_SRGB) defines.set('SCENE_COLORMAP_GAMMA', '');
            defines.set('FOG', this._fog.toUpperCase());
            defines.set('TONEMAP', tonemapNames[this._toneMapping]);
            defines.set('GAMMA', gammaNames[this.shaderOutputGamma]);
        }
        return defines;
    }

    markDirty() {
        this._hash = undefined;
        this._definesDirty = true;
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

    set sceneDepthMapLinear(value) {
        if (this._sceneDepthMapLinear !== value) {
            this._sceneDepthMapLinear = value;
            this.markDirty();
        }
    }

    get sceneDepthMapLinear() {
        return this._sceneDepthMapLinear;
    }

    set sceneDepthMapPacked(value) {
        if (this._sceneDepthMapPacked !== value) {
            this._sceneDepthMapPacked = value;
            this.markDirty();
        }
    }

    get sceneDepthMapPacked() {
        return this._sceneDepthMapPacked;
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
