Object.assign(pc, function () {
    'use strict';

    /**
     * @interface pc.ResourceHandler
     * @description Interface for ResourceHandlers
     */
    var ResourceHandler = function () {};

    Object.assign(ResourceHandler.prototype, {

        /**
         * @function
         * @name pc.ResourceHandler#load
         * @param {String} url The URL of the resource to load.
         * @param {Function} callback The callback used when the resource is loaded or an error occurs.
         */
        load: function (url, callback) {
            throw new Error('not implemented');
        },

        /**
         * @function
         * @name pc.ResourceHandler#open
         * @param {String} url The URL of the resource to open.
         * @param {Any} data The data passed into the callback from {@link pc.ResourceHandler#load}.
         * @param {pc.Asset} [asset] Optional asset that is passed by ResourceLoader.
         */
        open: function (url, data, asset) {
            throw new Error('not implemented');
        }
    });

    return {
        ResourceHandler: ResourceHandler
    };
}());
