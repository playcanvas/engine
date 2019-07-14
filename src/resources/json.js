Object.assign(pc, function () {
    'use strict';

    var JsonHandler = function () {
        this.retryRequests = false;
    };

    Object.assign(JsonHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            // if this a blob URL we need to set the response type as json
            var options = {
                retry: this.retryRequests
            };

            if (url.load.startsWith('blob:')) {
                options.responseType = pc.Http.ResponseType.JSON;
            }

            pc.http.get(url.load, options, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading JSON resource: {0} [{1}]", url.original, err));
                }
            });
        },

        open: function (url, data) {
            return data;
        },

        patch: function (asset, assets) {
        }
    });

    return {
        JsonHandler: JsonHandler
    };
}());
