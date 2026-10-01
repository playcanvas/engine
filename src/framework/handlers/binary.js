import { BinaryParser } from '../parsers/binary.js';
import { ResourceHandler } from './handler.js';

/**
 * Resource handler for the `binary` asset type. Loads a file as an `ArrayBuffer` without
 * interpreting its contents.
 *
 * @ignore
 */
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
