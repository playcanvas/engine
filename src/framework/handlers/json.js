import { JsonParser } from '../parsers/json.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Resource handler for the `json` asset type. Loads a JSON file and parses it into the JavaScript
 * value it encodes: an object, array, string, number, boolean or null.
 *
 * @category Asset
 */
class JsonHandler extends ResourceHandler {
    /**
     * TextDecoder for decoding binary data.
     *
     * @type {TextDecoder|null}
     * @private
     */
    decoder = null;

    /**
     * Create a new JsonHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'json');
        this.addParser(new JsonParser());
    }

    /**
     * Parses raw DataView and returns string.
     *
     * @param {DataView} data - The raw data as a DataView
     * @returns {object} The parsed resource data.
     * @ignore
     */
    openBinary(data) {
        this.decoder ??= new TextDecoder('utf-8');
        return JSON.parse(this.decoder.decode(data));
    }
}

export { JsonHandler };
