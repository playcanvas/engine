pc.extend(pc, function () {
    'use strict';

    var HtmlHandler = function () {};

    HtmlHandler.prototype = {
        load: function (url, callback) {
            pc.http.get(url, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading html resource: {0} [{1}]", url, err));
                }
            });
        },

        open: function (url, data) {
            return data;
        },

        patch: function (asset, assets) {
        }
    };

    return {
        HtmlHandler: HtmlHandler
    };
}());
