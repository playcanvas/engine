import { http, Http } from '../../platform/net/http.js';
import { ResourceHandler } from './handler.js';

class BinaryHandler extends ResourceHandler {
    constructor(app) {
        super(app, 'binary');
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

    /**
     * Parses raw DataView and returns ArrayBuffer.
     *
     * @param {DataView} data - The raw data as a DataView
     * @returns {ArrayBuffer} The parsed resource data.
     */
    openBinary(data) {
        return data.buffer;
    }
}

export { BinaryHandler };
