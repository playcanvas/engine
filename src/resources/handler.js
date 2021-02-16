/**
 * @interface
 * @name ResourceHandler
 * @description Interface for ResourceHandlers used by {@link ResourceLoader}.
 */
class ResourceHandler {
    constructor() {}

    /**
     * @function
     * @name ResourceHandler#load
     * @description Load a resource from a remote URL. When loaded (or failed),
     * use the callback to return an the raw resource data (or error).
     * @param {string|object} url - Either the URL of the resource to load or a structure containing the
     * load and original URL.
     * @param {string} [url.load] - The URL to be used for loading the resource.
     * @param {string} [url.original] - The original URL to be used for identifying the resource
     * format. This is necessary when loading, for example from blob.
     * @param {callbacks.ResourceHandler} callback - The callback used when the resource is loaded or an error occurs.
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
     */
    load(url, callback, asset) {
        throw new Error('not implemented');
    }

    /**
     * @function
     * @name ResourceHandler#open
     * @description Convert raw resource data into a resource instance. E.g. Take 3D model format JSON and return a pc.Model.
     * @param {string} url - The URL of the resource to open.
     * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
     * @returns {*} The parsed resource data.
     */
    /* eslint-disable jsdoc/require-returns-check */
    open(url, data, asset) {
        throw new Error('not implemented');
    }
    /* eslint-enable jsdoc/require-returns-check */

    /**
     * @function
     * @name ResourceHandler#[patch]
     * @description Optional function to perform any operations on a resource, that requires a dependency on its asset data
     * or any other asset data.
     * @param {Asset} asset - The asset to patch.
     * @param {AssetRegistry} assets - The asset registry.
     */
    patch(asset, assets) {
        // optional function
    }
}

export { ResourceHandler };
