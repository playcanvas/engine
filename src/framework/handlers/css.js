import { TextParser } from '../parsers/text.js';
import { ResourceHandler } from './handler.js';

/**
 * Resource handler for the `css` asset type. Loads a stylesheet file as a string. It does not
 * apply the stylesheet to the page.
 *
 * @ignore
 */
class CssHandler extends ResourceHandler {
    /**
     * TextDecoder for decoding binary data.
     *
     * @type {TextDecoder|null}
     * @private
     */
    decoder = null;

    constructor(app) {
        super(app, 'css');
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

export { CssHandler };
