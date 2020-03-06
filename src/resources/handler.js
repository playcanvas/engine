Object.assign(pc, function () {
    'use strict';

    /**
     * @interface
     * @name pc.ResourceHandler
     * @description Interface for ResourceHandlers used by {@link pc.ResourceLoader}.
     */
    var ResourceHandler = function () {};

    Object.assign(ResourceHandler.prototype, {

        /**
         * @function
         * @name pc.ResourceHandler#load
         * @description Load a resource from a remote URL. When loaded (or failed),
         * use the callback to return an the raw resource data (or error).
         * @param {string} url - The URL of the resource to load.
         * @param {pc.callbacks.ResourceHandler} callback - The callback used when the resource is loaded or an error occurs.
         * @param {pc.Asset} [asset] - Optional asset that is passed by ResourceLoader.
         */
        load: function (url, callback, asset) {
            throw new Error('not implemented');
        },

        /**
         * @function
         * @name pc.ResourceHandler#open
         * @description Convert raw resource data into a resource instance and return it. E.g. Take 3D model format JSON and return a pc.Model. The
         * loader will use the asynchronous version of open if one is provided by the resource handler (see {@link pc.ResourceHandler#openAsync}),
         * otherwise it will use this version.
         * @param {string} url - The URL of the resource to open.
         * @param {*} data - The raw resource data passed by callback from {@link pc.ResourceHandler#load}.
         * @param {pc.Asset} [asset] - Optional asset that is passed by ResourceLoader.
         * @returns {*} The parsed resource data.
         */
        /* eslint-disable jsdoc/require-returns-check */
        open: function (url, data, asset) {
            throw new Error('not implemented');
        },
        /* eslint-enable jsdoc/require-returns-check */

        /**
         * @function
         * @name pc.ResourceHandler#openAsync
         * @description Convert raw resource data into a resource instance and return it asynchronously via the passed in callback. E.g. Take 3D
         * model format JSON and return a pc.Model. The loader will use the asynchronous version of open if one is provided by the resource handler,
         * otherwise it will use the synchronous version. See {@link pc.ResourceHandler#open}.
         * @param {string} url - The URL of the resource to open.
         * @param {*} data - The raw resource data passed by callback from {@link pc.ResourceHandler#load}.
         * @param {pc.Asset} asset - Asset that is passed by ResourceLoader.
         * @param {pc.callbacks.ResourceHandler} callback - Callback function called when the open completes. The
         * callback is of the form fn(err, response), where err is a String error message in
         * the case where the load fails, and response is the model data that has been
         * successfully loaded.
         */
        /* eslint-disable jsdoc/require-returns-check */
        openAsync: function (url, data, asset, callback) {
            throw new Error('not implemented');
        },
        /* eslint-enable jsdoc/require-returns-check */

        /**
         * @function
         * @name pc.ResourceHandler#[patch]
         * @description Optional function to perform any operations on a resource, that requires a dependency on its asset data
         * or any other asset data.
         * @param {pc.Asset} asset - The asset to patch.
         * @param {pc.AssetRegistry} assets - The asset registry.
         */
        patch: function (asset, assets) {
            // optional function
        }
    });

    return {
        ResourceHandler: ResourceHandler
    };
}());
