import { BinaryParser } from '../parsers/binary.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Resource handler for the `binary` asset type. Loads a file as an `ArrayBuffer` without
 * interpreting its contents.
 *
 * @category Asset
 */
class BinaryHandler extends ResourceHandler {
    /**
     * Create a new BinaryHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'binary');
        this.addParser(new BinaryParser());
    }

    /**
     * Parses raw DataView and returns ArrayBuffer.
     *
     * @param {DataView} data - The raw data as a DataView
     * @returns {ArrayBuffer} The parsed resource data.
     * @ignore
     */
    openBinary(data) {
        return data.buffer;
    }
}

export { BinaryHandler };
