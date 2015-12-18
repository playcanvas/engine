pc.extend(pc, function () {
    'use strict';

    var ShaderHandler = function () {};

    ShaderHandler.prototype = {
        load: function (url, callback) {
            pc.net.http.get(url, function (response) {
                callback(null, response);
            }, {
                error: function (status, xhr, e) {
                    callback(pc.string.format("Error loading shader resource: {0} [{1}]", url, status));
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
        ShaderHandler: ShaderHandler
    };
}());
