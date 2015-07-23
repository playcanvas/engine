pc.extend(pc, function () {
    'use strict';

    var CssHandler = function () {};

    CssHandler.prototype = {
        load: function (url, callback) {
            pc.net.http.get(url, function (response) {
                callback(null, response);
            }, {
                error: function (status, xhr, e) {
                    callback(pc.string.format("Error loading css resource: {0} [{1}]", url, status));
                }
            });
        },

        open: function (url, data) {
            return data;
        },

        patch: function (asset, assets) {
        }
    };

    var createStyle = function (cssString) {
        var result = document.createElement('style');
        result.type = 'text/css';
        if (result.styleSheet) {
            result.styleSheet.cssText = cssString;
        } else {
            result.appendChild(document.createTextNode(cssString));
        }

        return result;
    };

    return {
        CssHandler: CssHandler,
        createStyle: createStyle
    };
}());
