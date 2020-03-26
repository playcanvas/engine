Object.assign(pc, function () {
    'use strict';

    /**
     * @class
     * @name pc.AnimationStateGraphHandler
     * @implements {pc.ResourceHandler}
     * @classdesc Resource handler used for loading {@link pc.AnimationStateGraph} resources.
     */
    var AnimationStateGraphHandler = function () {
        this.retryRequests = false;
    };

    Object.assign(AnimationStateGraphHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            // we need to specify JSON for blob URLs
            var options = {
                retry: this.retryRequests
            };

            if (url.load.startsWith('blob:')) {
                options.responseType = pc.Http.ResponseType.JSON;
            }

            pc.http.get(url.load, options, function (err, response) {
                if (err) {
                    callback(pc.string.format("Error loading animation state graph resource: {0} [{1}]", url.original, err));
                } else {
                    callback(null, response);
                }
            });
        },

        open: function (url, data) {
            return data;
        },
    });

    return {
        AnimationStateGraphHandler: AnimationStateGraphHandler
    };
}());
