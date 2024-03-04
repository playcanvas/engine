import { http } from '../../platform/net/http.js';
import { ResourceHandler } from './handler.js';

class ShaderHandler extends ResourceHandler {
    /**
     * TextDecoder for decoding binary data.
     *
     * @type {TextDecoder}
     * @private
     */
    decoder = new TextDecoder('utf-8');

    constructor(app) {
        super(app, 'shader');
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
                callback(`Error loading shader resource: ${url.original} [${err}]`);
            }
        });
    }

    /**
     * Parses raw DataView and returns string.
     * 
     * @param {DataView} data - The raw data as a DataView
     * @returns {string} The parsed resource data.
    */
    openBinary(data) {
        return this.decoder.decode(data);
    }
}

export { ShaderHandler };
