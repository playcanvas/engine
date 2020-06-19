import { http } from '../net/http.js';

function TextHandler() {
    this.retryRequests = false;
}

Object.assign(TextHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        http.get(url.load, {
            retry: this.retryRequests
        }, function (err, response) {
            if (!err) {
                callback(null, response);
            } else {
                callback("Error loading text resource: " + url.original + " [" + err + "]");
            }
        });
    },

    open: function (url, data) {
        return data;
    },

    patch: function (asset, assets) {
    }
});

export { TextHandler };
