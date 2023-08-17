import { http, Http } from '../../platform/net/http.js';

import { ResourceHandler } from './handler.js';

class BinaryHandler extends ResourceHandler {
    constructor() {
        super('binary');
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        http.get(url.load, {
            responseType: Http.ResponseType.ARRAY_BUFFER,
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        }, function (err, response) {
            if (!err) {
                callback(null, response);
            } else {
                callback(`Error loading binary resource: ${url.original} [${err}]`);
            }
        });
    }
}

export { BinaryHandler };
