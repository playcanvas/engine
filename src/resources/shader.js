Object.assign(pc, (function () {
    'use strict';

    function ShaderHandler() {
    }

    ShaderHandler.prototype = {
        constructor: ShaderHandler,

        load: function (url, callback) {
            pc.http.get(url, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading shader resource: {0} [{1}]", url, err));
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
}()));
