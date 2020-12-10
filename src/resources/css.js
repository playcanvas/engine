import { http } from '../net/http.js';

function CssHandler() {
    this.maxRetries = 0;
}

Object.assign(CssHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        http.get(url.load, {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        }, function (err, response) {
            if (!err) {
                callback(null, response);
            } else {
                callback("Error loading css resource: " + url.original + " [" + err + "]");
            }
        });
    },

    open: function (url, data) {
        return data;
    },

    patch: function (asset, assets) {
    }
});

/**
 * @function
 * @name pc.createStyle
 * @description Creates a &lt;style&gt; DOM element from a string that contains CSS.
 * @param {string} cssString - A string that contains valid CSS.
 * @example
 * var css = 'body {height: 100;}';
 * var style = pc.createStyle(css);
 * document.head.appendChild(style);
 * @returns {Element} The style DOM element.
 */
function createStyle(cssString) {
    var result = document.createElement('style');
    result.type = 'text/css';
    if (result.styleSheet) {
        result.styleSheet.cssText = cssString;
    } else {
        result.appendChild(document.createTextNode(cssString));
    }

    return result;
}

export { createStyle, CssHandler };
