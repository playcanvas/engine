import { Debug } from '../../core/debug.js';

/**
 * @import { IndexBuffer } from './index-buffer.js'
 * @import { VertexBuffer } from './vertex-buffer.js'
 */

/**
 * A class providing utility functions for vertex and index buffers.
 *
 * @ignore
 */
class BufferUtils {
    /**
     * Creates a typed array aliasing the storage of a vertex or index buffer. The storage of those
     * buffers is stored by reference, and so it can be either an {@link ArrayBuffer} or a typed
     * array, which itself can be a view into a larger buffer. Constructing a typed array directly
     * from the storage handles only the former case - for a typed array, the byte offset and length
     * arguments are ignored and the data is copied instead of aliased, silently detaching the
     * result from the buffer. This function handles both cases.
     *
     * @param {VertexBuffer|IndexBuffer} buffer - The buffer to create the view over.
     * @param {Function} arrayType - The typed array constructor to create the view with, for
     * example Float32Array.
     * @param {number} [byteOffset] - The offset in bytes from the start of the buffer's data.
     * Defaults to 0.
     * @param {number} [length] - The number of elements the view contains. Defaults to the
     * remainder of the buffer's data.
     * @returns {*} A typed array of the specified type, aliasing the buffer's storage.
     */
    static createStorageView(buffer, arrayType, byteOffset = 0, length) {

        const storage = buffer.storage;
        const isView = ArrayBuffer.isView(storage);
        const arrayBuffer = isView ? storage.buffer : storage;
        const offset = (isView ? storage.byteOffset : 0) + byteOffset;

        // a typed array view requires the byte offset to be a multiple of its element size, which
        // cannot be satisfied when the storage is a misaligned view into a larger buffer
        const elementSize = arrayType.BYTES_PER_ELEMENT;
        Debug.assert(offset % elementSize === 0,
            `Buffer storage cannot be viewed as ${arrayType.name} at byte offset ${offset}, as it is not a multiple of ${elementSize}.`);

        return new arrayType(arrayBuffer, offset, length ?? Math.floor((buffer.numBytes - byteOffset) / elementSize));
    }
}

export { BufferUtils };
