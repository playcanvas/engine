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
     * The texture this view references.
     *
     * @type {Texture}
     * @readonly
     */
    texture;

    /**
     * The first mip level accessible to the view.
     *
     * @type {number}
     * @readonly
     */
    baseMipLevel;

    /**
     * The number of mip levels accessible to the view.
     *
     * @type {number}
     * @readonly
     */
    mipLevelCount;

    /**
     * The first array layer accessible to the view.
     *
     * @type {number}
     * @readonly
     */
    baseArrayLayer;

    /**
     * The number of array layers accessible to the view.
     *
     * @type {number}
     * @readonly
     */
    arrayLayerCount;

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
        this.texture = texture;
        this.baseMipLevel = baseMipLevel;
        this.mipLevelCount = mipLevelCount;
        this.baseArrayLayer = baseArrayLayer;
        this.arrayLayerCount = arrayLayerCount;

        // Generate a unique numeric key for caching
        this.key = stringIds.get(`${baseMipLevel}:${mipLevelCount}:${baseArrayLayer}:${arrayLayerCount}`);
    }
}

export { TextureView };
