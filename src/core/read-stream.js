/**
 * @private
 * @class
 * @name ReadStream
 * @classdesc Helper class for organized reading of memory.
 */
class ReadStream {
    constructor(arraybuffer) {
        this.arraybuffer = arraybuffer;
        this.dataView = new DataView(arraybuffer);
        this.offset = 0;
        this.stack = [];
    }

    get remainingBytes() {
        return this.dataView.byteLength - this.offset;
    }

    reset(offset = 0) {
        this.offset = offset;
    }

    skip(bytes) {
        this.offset += bytes;
    }

    align(bytes) {
        this.offset = (this.offset + bytes - 1) & (~(bytes - 1));
    }

    _inc(amount) {
        this.offset += amount;
        return this.offset - amount;
    }

    readChar() {
        return String.fromCharCode(this.dataView.getUint8(this.offset++));
    }

    readChars(numChars) {
        let result = '';
        for (let i = 0; i < numChars; ++i) {
            result += this.readChar();
        }
        return result;
    }

    readU8() {
        return this.dataView.getUint8(this.offset++);
    }

    readU16() {
        return this.dataView.getUint16(this._inc(2), true);
    }

    readU32() {
        return this.dataView.getUint32(this._inc(4), true);
    }

    readU64() {
        return this.readU32() + 2 ** 32 * this.readU32();
    }

    // big-endian
    readU32be() {
        return this.dataView.getUint32(this._inc(4), false);
    }

    readArray(result) {
        for (let i = 0; i < result.length; ++i) {
            result[i] = this.readU8();
        }
    }

    readLine() {
        const view = this.dataView;
        let result = "";
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
