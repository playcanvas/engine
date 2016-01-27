pc.extend(pc, function () {
    'use strict';

    var CssHandler = function () {};

    CssHandler.prototype = {
        load: function (url, callback) {
            pc.http.get(url, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading css resource: {0} [{1}]", url, err));
                }
            });
        },

        open: function (url, data) {
            return data;
        },

        patch: function (asset, assets) {
        }
    };

    /**
     * @function
     * @name pc.createStyle
     * @description Creates a &lt;style&gt; DOM element from a string that contains CSS
     * @param {String} cssString A string that contains valid CSS
     * @example
     * var css = 'body {height: 100;}';
     * var style = pc.createStyle(css);
     * document.head.appendChild(style);
     * @return {Element} The style DOM element
     */
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
