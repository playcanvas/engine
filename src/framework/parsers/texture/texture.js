/**
 * Interface to a texture parser. Implementations of this interface handle the loading
 * and opening of texture assets.
 *
 * @ignore
 */
class TextureParser {
    /* eslint-disable jsdoc/require-returns-check */
    /**
     * @function
     * @name TextureParser#load
     * @description Load the texture from the remote URL. When loaded (or failed),
     * use the callback to return an the raw resource data (or error).
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {import('../../../framework/handlers/handler.js').ResourceHandlerCallback} callback - The callback used when
     * the resource is loaded or an error occurs.
     * @param {import('../../asset/asset.js').Asset} [asset] - Optional asset that is passed by
     * ResourceLoader.
     */
    load(url, callback, asset) {
        throw new Error('not implemented');
    }

    /**
     * @function
     * @name TextureParser#open
     * @description Convert raw resource data into a resource instance. E.g. Take 3D model format
     * JSON and return a {@link Model}.
     * @param {string} url - The URL of the resource to open.
     * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
     * @param {import('../../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
     * @returns {import('../../../platform/graphics/texture.js').Texture} The parsed resource data.
     */
    open(url, data, device) {
        throw new Error('not implemented');
    }
    /* eslint-enable jsdoc/require-returns-check */
}

export { TextureParser };
