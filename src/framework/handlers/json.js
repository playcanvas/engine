import { http, Http } from '../../platform/net/http.js';
import { ResourceHandler } from './handler.js';

class JsonHandler extends ResourceHandler {
    /**
     * TextDecoder for decoding binary data.
     *
     * @type {TextDecoder|null}
     * @private
     */
    decoder = null;

    constructor(app) {
        super(app, 'json');
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // if this a blob URL we need to set the response type as json
        const options = {
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
                callback(`Error loading JSON resource: ${url.original} [${err}]`);
            }
        });
    }

    /**
     * Parses raw DataView and returns string.
     *
     * @param {DataView} data - The raw data as a DataView
     * @returns {object} The parsed resource data.
     */
    openBinary(data) {
        this.decoder ??= new TextDecoder('utf-8');
        return JSON.parse(this.decoder.decode(data));
    }
}

export { JsonHandler };
