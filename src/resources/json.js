pc.extend(pc, function () {
    'use strict';

    function JsonHandler() {
    }

    JsonHandler.prototype = {
        constructor: JsonHandler,

        load: function (url, callback) {
            pc.http.get(url, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading JSON resource: {0} [{1}]", url, err));
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
        JsonHandler: JsonHandler
    };
}());
