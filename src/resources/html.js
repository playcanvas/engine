Object.assign(pc, function () {
    'use strict';

    var HtmlHandler = function () {
        this.retryRequests = false;
    };

    Object.assign(HtmlHandler.prototype, {
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
                    callback("Error loading html resource: " + url.original + " [" + err + "]");
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
        HtmlHandler: HtmlHandler
    };
}());
