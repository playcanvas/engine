import { JsonParser } from '../parsers/json.js';
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
        this.addParser(new JsonParser());
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
