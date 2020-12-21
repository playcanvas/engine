import { http, Http } from '../net/http.js';

function JsonHandler() {
    this.maxRetries = 0;
}

Object.assign(JsonHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // if this a blob URL we need to set the response type as json
        var options = {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };

        if (url.load.startsWith('blob:')) {
            options.responseType = Http.ResponseType.JSON;
        }

        http.get(url.load, options, function (err, response) {
            if (!err) {
                callback(null, response);
            } else {
                callback("Error loading JSON resource: " + url.original + " [" + err + "]");
            }
        });
    },

    open: function (url, data) {
        return data;
    },

    patch: function (asset, assets) {
    }
});

export { JsonHandler };
