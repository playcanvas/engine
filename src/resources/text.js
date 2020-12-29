import { http } from '../net/http.js';

class TextHandler {
    constructor() {
        this.maxRetries = 0;
    }

    load(url, callback) {
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
                callback("Error loading text resource: " + url.original + " [" + err + "]");
            }
        });
    }

    open(url, data) {
        return data;
    }

    patch(asset, assets) {
    }
}

export { TextHandler };
