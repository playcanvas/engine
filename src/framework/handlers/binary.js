import { BinaryParser } from '../parsers/binary.js';
import { ResourceHandler } from './handler.js';

class BinaryHandler extends ResourceHandler {
    constructor(app) {
        super(app, 'binary');
        this.addParser(new BinaryParser());
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
