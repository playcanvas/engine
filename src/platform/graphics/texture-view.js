import { StringIds } from '../../core/string-ids.js';

/**
 * @import { Texture } from './texture.js'
 */

const stringIds = new StringIds();

/**
 * A TextureView specifies a texture and a subset of its mip levels and array layers. It is used
 * when binding textures to compute shaders to specify which portion of the texture should be
 * accessed. Create a TextureView using {@link Texture#getView}.
 *
 * Note: TextureView is only supported on WebGPU. On WebGL, the full texture is always bound and
 * this class has no effect.
 *
 * @category Graphics
 */
class TextureView {
    /**
     * @type {Texture}
     * @private
     */
    _texture;

    /**
     * @type {number}
     * @private
     */
    _baseMipLevel;

    /**
     * @type {number}
     * @private
     */
    _mipLevelCount;

    /**
     * @type {number}
     * @private
     */
    _baseArrayLayer;

    /**
     * @type {number}
     * @private
     */
    _arrayLayerCount;

    /**
     * A unique numeric key for this view configuration, used for caching.
     *
     * @type {number}
     * @ignore
     */
    key;

    /**
     * Create a new TextureView instance. Use {@link Texture#getView} instead of calling this
     * constructor directly.
     *
     * @param {Texture} texture - The texture this view references.
     * @param {number} [baseMipLevel] - The first mip level accessible to the view. Defaults to 0.
     * @param {number} [mipLevelCount] - The number of mip levels accessible to the view. Defaults
     * to 1.
     * @param {number} [baseArrayLayer] - The first array layer accessible to the view. Defaults to
     * 0.
     * @param {number} [arrayLayerCount] - The number of array layers accessible to the view.
     * Defaults to 1.
     * @ignore
     */
    constructor(texture, baseMipLevel = 0, mipLevelCount = 1, baseArrayLayer = 0, arrayLayerCount = 1) {
        this._texture = texture;
        this._baseMipLevel = baseMipLevel;
        this._mipLevelCount = mipLevelCount;
        this._baseArrayLayer = baseArrayLayer;
        this._arrayLayerCount = arrayLayerCount;

        // Generate a unique numeric key for caching
        this.key = stringIds.get(`${baseMipLevel}:${mipLevelCount}:${baseArrayLayer}:${arrayLayerCount}`);
    }

    /**
     * The texture this view references.
     *
     * @type {Texture}
     * @readonly
     */
    get texture() {
        return this._texture;
    }

    /**
     * The first mip level accessible to the view.
     *
     * @type {number}
     * @readonly
     */
    get baseMipLevel() {
        return this._baseMipLevel;
    }

    /**
     * The number of mip levels accessible to the view.
     *
     * @type {number}
     * @readonly
     */
    get mipLevelCount() {
        return this._mipLevelCount;
    }

    /**
     * The first array layer accessible to the view.
     *
     * @type {number}
     * @readonly
     */
    get baseArrayLayer() {
        return this._baseArrayLayer;
    }

    /**
     * The number of array layers accessible to the view.
     *
     * @type {number}
     * @readonly
     */
    get arrayLayerCount() {
        return this._arrayLayerCount;
    }
}

export { TextureView };
