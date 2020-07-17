import { http, Http } from '../net/http.js';

function BinaryHandler() {
    this.retryRequests = false;
}

Object.assign(BinaryHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        http.get(url.load, {
            responseType: Http.ResponseType.ARRAY_BUFFER,
            retry: this.retryRequests
        }, function (err, response) {
            if (!err) {
                callback(null, response);
            } else {
                callback("Error loading binary resource: " + url.original + " [" + err + "]");
            }
        });
    },

    open: function (url, data) {
        return data;
    },

    patch: function (asset, assets) {
    }
});

export { BinaryHandler };
