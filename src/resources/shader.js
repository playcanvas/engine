Object.assign(pc, function () {
    'use strict';

    var ShaderHandler = function () {
        this.retryRequests = false;
    };

    Object.assign(ShaderHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            pc.http.get(url.load, {
                retry: this.retryRequests
            }, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading shader resource: {0} [{1}]", url.original, err));
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
        ShaderHandler: ShaderHandler
    };
}());
