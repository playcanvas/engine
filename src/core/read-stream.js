/**
 * Helper class for organized reading of memory.
 *
 * @ignore
 */
class ReadStream {
    /** @type {ArrayBuffer} */
    arraybuffer;

    /** @type {DataView} */
    dataView;

    /** @type {number} */
    offset = 0;

    /**
     * @param {ArrayBuffer} arraybuffer - The buffer to read from.
     */
    constructor(arraybuffer) {
        this.arraybuffer = arraybuffer;
        this.dataView = new DataView(arraybuffer);
    }

    /**
     * The number of bytes remaining to be read.
     *
     * @type {number}
     */
    get remainingBytes() {
        return this.dataView.byteLength - this.offset;
    }

    /**
     * Resets the offset to a given value. If no value is given, the offset is reset to 0.
     *
     * @param {number} offset - The new offset.
     */
    reset(offset = 0) {
        this.offset = offset;
    }

    /**
     * Skips a number of bytes.
     *
     * @param {number} bytes - The number of bytes to skip.
     */
    skip(bytes) {
        this.offset += bytes;
    }

    /**
     * Aligns the offset to a multiple of a number of bytes.
     *
     * @param {number} bytes - The number of bytes to align to.
     */
    align(bytes) {
        this.offset = (this.offset + bytes - 1) & (~(bytes - 1));
    }

    /**
     * Increments the offset by the specified number of bytes and returns the previous offset.
     *
     * @param {number} amount - The number of bytes to increment by.
     * @returns {number} The previous offset.
     * @private
     */
    _inc(amount) {
        this.offset += amount;
        return this.offset - amount;
    }

    /**
     * Reads a single character.
     *
     * @returns {string} The character.
     */
    readChar() {
        return String.fromCharCode(this.dataView.getUint8(this.offset++));
    }

    /**
     * Reads a string of a given length.
     *
     * @param {number} numChars - The number of characters to read.
     * @returns {string} The string.
     */
    readChars(numChars) {
        let result = '';
        for (let i = 0; i < numChars; ++i) {
            result += this.readChar();
        }
        return result;
    }

    /**
     * Read an unsigned 8-bit integer.
     *
     * @returns {number} The integer.
     */
    readU8() {
        return this.dataView.getUint8(this.offset++);
    }

    /**
     * Read an unsigned 16-bit integer.
     *
     * @returns {number} The integer.
     */
    readU16() {
        return this.dataView.getUint16(this._inc(2), true);
    }

    /**
     * Read an unsigned 32-bit integer.
     *
     * @returns {number} The integer.
     */
    readU32() {
        return this.dataView.getUint32(this._inc(4), true);
    }

    /**
     * Read an unsigned 64-bit integer.
     *
     * @returns {number} The integer.
     */
    readU64() {
        return this.readU32() + 2 ** 32 * this.readU32();
    }

    /**
     * Read a big endian unsigned 32-bit integer.
     *
     * @returns {number} The integer.
     */
    readU32be() {
        return this.dataView.getUint32(this._inc(4), false);
    }

    /**
     * Read unsigned 8-bit integers into an array.
     *
     * @param {number[]} result - The array to read into.
     */
    readArray(result) {
        for (let i = 0; i < result.length; ++i) {
            result[i] = this.readU8();
        }
    }

    /**
     * Read a line of text from the stream.
     *
     * @returns {string} The line of text.
     */
    readLine() {
        const view = this.dataView;
        let result = '';
        while (true) {
            if (this.offset >= view.byteLength) {
                break;
            }

            const c = String.fromCharCode(this.readU8());
            if (c === '\n') {
                break;
            }
            result += c;
        }
        return result;
    }
}

export { ReadStream };
