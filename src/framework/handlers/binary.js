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
     * Returns the bytes covered by a DataView as a new ArrayBuffer.
     *
     * @param {DataView} data - The raw data as a DataView.
     * @returns {ArrayBuffer} The parsed resource data.
     * @ignore
     */
    openBinary(data) {
        // the view can cover a part of a larger buffer, such as a file inside an asset bundle
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
}

export { BinaryHandler };
