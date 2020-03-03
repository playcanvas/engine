Object.assign(pc, function () {
    /**
     * @class
     * @name pc.ContainerHandler
     * @implements {pc.ResourceHandler}
     * @classdesc Resource handler used for loading {@link pc.Model} resources.
     * @param {pc.GraphicsDevice} device - The graphics device that will be rendering.
     * @param {pc.StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
     */
    var ContainerHandler = function (device, defaultMaterial) {
        this._device = device;
        this._parsers = [];
        this._defaultMaterial = defaultMaterial;
        this.retryRequests = false;
        this._parser = new pc.GlbModelParser(this._device);
    };

    Object.assign(ContainerHandler.prototype, {
        /**
         * @function
         * @name pc.ContainerHandler#load
         * @description Fetch model data from a remote url.
         * @param {string} url - The URL of the model data.
         * @param {pc.callbacks.ResourceHandler} callback - Callback function called when the load completes. The
         * callback is of the form fn(err, response), where err is a String error message in
         * the case where the load fails, and response is the model data that has been
         * successfully loaded.
         */
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var options = {
                responseType: pc.Http.ResponseType.ARRAY_BUFFER,
                retry: this.retryRequests
            };

            pc.http.get(url.load, options, function (err, response) {
                if (!callback)
                    return;

                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading model: {0} [{1}]", url.original, err));
                }
            });
        },

        openAsync: function (url, data, asset, callback) {
            this._parser.parse(data, callback);
            return true;
        }
    });

    return {
        ContainerHandler: ContainerHandler
    };
}());
