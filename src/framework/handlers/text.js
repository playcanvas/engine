import { http } from '../../platform/net/http.js';

import { ResourceHandler } from './handler.js';

class TextHandler extends ResourceHandler {
    constructor(app) {
        super(app, 'text');
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
                callback(`Error loading text resource: ${url.original} [${err}]`);
            }
        });
    }
}

export { TextHandler };
