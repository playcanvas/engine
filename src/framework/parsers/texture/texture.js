/**
 * @import { Asset } from '../../asset/asset.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { ResourceHandlerCallback } from '../../../framework/handlers/handler.js'
 * @import { Texture } from '../../../platform/graphics/texture.js'
 */

/**
 * Interface to a texture parser. Implementations of this interface handle the loading and opening
 * of texture assets.
 */
class TextureParser {
    /**
     * Load the texture from the remote URL. When loaded (or failed), use the callback to return an
     * the raw resource data (or error).
     *
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {ResourceHandlerCallback} callback - The callback used when the resource is loaded or
     * an error occurs.
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
     */
    load(url, callback, asset) {
        throw new Error('not implemented');
    }

    /* eslint-disable jsdoc/require-returns-check */
    /**
     * Convert raw resource data into a {@link Texture}.
     *
     * @param {string} url - The URL of the resource to open.
     * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {Texture} The parsed resource data.
     */
    open(url, data, device) {
        throw new Error('not implemented');
    }
    /* eslint-enable jsdoc/require-returns-check */
}

export { TextureParser };
