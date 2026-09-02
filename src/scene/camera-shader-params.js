import { array } from '../core/array-utils.js';
import { Debug } from '../core/debug.js';
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
     * True when the linear scene depth map holds a coverage weighted average of the reciprocals of the
     * depths, which a consumer inverts to recover the depth. This is how the scene pass accumulates a
     * depth the blended gaussian splats contribute to. A pixel nothing was rendered to holds the
     * reciprocal of the far clip the map was cleared to, and so reads back as the far clip itself. Only
     * meaningful when {@link CameraShaderParams#sceneDepthMapLinear} is set.
     *
     * @private
     */
    _sceneDepthMapReciprocal = false;

    /**
     * The names of the scene textures the scene pass renders alongside the scene color, in the order
     * of the color attachments they are rendered to - the name at index i goes to the attachment at
     * index i + 1, as attachment 0 is the scene color itself. Empty when the scene pass renders the
     * scene color alone.
     *
     * The render pass is what owns this, as only the passes rendering to a render target the scene
     * textures are attached to may write them - a camera's pass rendering the UI to the output render
     * target must not. It is mirrored here because shader generation is given no more than the camera
     * shader params, so this is how a material learns that its shader has to write the additional
     * attachments, and how those attachments take part in the shader variant key.
     *
     * That makes the value transient: {@link RenderPassForward} assigns it and restores the previous
     * value around each layer step it renders, in the same way it overrides the gamma correction and
     * the tone mapping. Outside of those draws the camera reads as rendering no scene textures.
     *
     * @type {string[]}
     * @private
     */
    _sceneTextures = [];

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
            const key = `${this.gammaCorrection}_${this.toneMapping}_${this.srgbRenderTarget}_${this.fog}_${this.ssaoEnabled}_${this.sceneDepthMapLinear}_${this.sceneDepthMapPacked}_${this.sceneDepthMapReciprocal}_${this._sceneTextures.join('-')}`;
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
                if (this._sceneDepthMapReciprocal) defines.set('SCENE_DEPTHMAP_RECIPROCAL', '');
            }

            // each scene texture supplies a pair of defines - one enabling its write, and one giving
            // the color attachment it is written to, which the preprocessor substitutes into the name
            // of the output the sceneTexturesPS chunk writes
            this._sceneTextures.forEach((name, index) => {
                const upperName = name.toUpperCase();
                defines.set(`SCENE_TEXTURE_${upperName}`, '');
                defines.set(`{SCENE_TEXTURE_${upperName}_SLOT}`, String(index + 1));
            });
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

    set sceneDepthMapReciprocal(value) {
        if (this._sceneDepthMapReciprocal !== value) {
            this._sceneDepthMapReciprocal = value;
            this.markDirty();
        }
    }

    get sceneDepthMapReciprocal() {
        return this._sceneDepthMapReciprocal;
    }

    /**
     * Sets the names of the scene textures the scene pass renders alongside the scene color, for
     * example `['depth']`. Their order is the order of the color attachments they are rendered to,
     * so the name at index i is written to the attachment at index i + 1. Assign an empty array when
     * the scene pass renders the scene color alone. This is assigned by the render pass rendering
     * them, for the duration of its draws only - see the note on the backing field.
     *
     * Each name generates a pair of shader defines, following the same naming as the shader passes:
     * `'depth'` supplies `SCENE_TEXTURE_DEPTH`, which enables the write, and
     * `{SCENE_TEXTURE_DEPTH_SLOT}`, which the sceneTexturesPS chunk substitutes into the name of the
     * output it writes. A name can only contain letters, numbers and underscores, and start with a
     * letter.
     *
     * @type {string[]}
     */
    set sceneTextures(value) {

        const names = value ?? [];

        Debug.call(() => {
            names.forEach((name) => {
                Debug.assert(/^[a-z]\w*$/i.test(name), `Scene texture name can only contain letters, numbers and underscores and start with a letter: ${name}`);
            });
        });

        // compared by value, as this is assigned by each render pass as it executes, and taking a
        // new array of the same names must not invalidate the shader variants of every material
        if (!array.equals(this._sceneTextures, names)) {
            this._sceneTextures = names.slice();
            this.markDirty();
        }
    }

    get sceneTextures() {
        return this._sceneTextures;
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
