pc.extend(pc, function () {
    'use strict';

    var BinaryHandler = function () {

    };

    BinaryHandler.prototype = {
        load: function (url, callback) {
            pc.http.get(url, {responseType: pc.Http.ResponseType.ARRAY_BUFFER}, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading binary resource: {0} [{1}]", url, err));
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
        BinaryHandler: BinaryHandler
    };
}());
