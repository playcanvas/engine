import { TextParser } from '../parsers/text.js';
import { ResourceHandler } from './handler.js';

/**
 * Resource handler for the `text` asset type. Loads a file as a string.
 *
 * @ignore
 */
class TextHandler extends ResourceHandler {
    /**
     * TextDecoder for decoding binary data.
     *
     * @type {TextDecoder|null}
     * @private
     */
    decoder = null;

    constructor(app) {
        super(app, 'text');
        this.addParser(new TextParser());
    }

    /**
     * Parses raw DataView and returns string.
     *
     * @param {DataView} data - The raw data as a DataView
     * @returns {string} The parsed resource data.
     */
    openBinary(data) {
        this.decoder ??= new TextDecoder('utf-8');
        return this.decoder.decode(data);
    }
}

export { TextHandler };
