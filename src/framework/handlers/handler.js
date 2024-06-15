/**
 * Callback used by {@link ResourceHandler#load} when a resource is loaded (or an error occurs).
 *
 * @callback ResourceHandlerCallback
 * @param {string|null} err - The error message in the case where the load fails.
 * @param {*} [response] - The raw data that has been successfully loaded.
 */

/**
 * Base class for ResourceHandlers used by {@link ResourceLoader}.
 */
class ResourceHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = '';

    /**
     * The running app instance.
     *
     * @type {import('../app-base').AppBase}
     */
    _app;

    /** @private */
    _maxRetries = 0;

    /**
     * @param {import('../app-base').AppBase} app - The running {@link AppBase}.
     * @param {string} handlerType - The type of the resource the handler handles.
     */
    constructor(app, handlerType) {
        this._app = app;
        this.handlerType = handlerType;
    }

    /**
     * Sets the number of times to retry a failed request for the resource.
     *
     * @type {number}
     */
    set maxRetries(value) {
        this._maxRetries = value;
    }

    /**
     * Gets the number of times to retry a failed request for the resource.
     *
     * @type {number}
     */
    get maxRetries() {
        return this._maxRetries;
    }

    /**
     * Load a resource from a remote URL. The base implementation does nothing.
     *
     * @param {string|object} url - Either the URL of the resource to load or a structure
     * containing the load and original URL.
     * @param {string} [url.load] - The URL to be used for loading the resource.
     * @param {string} [url.original] - The original URL to be used for identifying the resource
     * format. This is necessary when loading, for example from blob.
     * @param {ResourceHandlerCallback} callback - The callback used when the resource is loaded or
     * an error occurs.
     * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
     * ResourceLoader.
     */
    load(url, callback, asset) {
        // do nothing
    }

    /**
     * The open function is passed the raw resource data. The handler can then process the data
     * into a format that can be used at runtime. The base implementation simply returns the data.
     *
     * @param {string} url - The URL of the resource to open.
     * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
     * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
     * ResourceLoader.
     * @returns {*} The parsed resource data.
     */
    open(url, data, asset) {
        return data;
    }

    /**
     * The patch function performs any operations on a resource that requires a dependency on its
     * asset data or any other asset data. The base implementation does nothing.
     *
     * @param {import('../asset/asset.js').Asset} asset - The asset to patch.
     * @param {import('../asset/asset-registry.js').AssetRegistry} assets - The asset registry.
     */
    patch(asset, assets) {
        // do nothing
    }
}

export { ResourceHandler };
