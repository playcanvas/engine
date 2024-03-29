import { EventHandler } from '../../core/event-handler.js';

/**
 * A utility class for untaring archives from a fetch request. It processes files from a tar file
 * in a streamed manner, so asset parsing can happen in parallel instead of all at once at the end.
 *
 * @ignore
 */
class Untar extends EventHandler {
    /**
     * @type {number}
     * @private
     */
    headerSize = 512;

    /**
     * @type {number}
     * @private
     */
    paddingSize = 512;

    /**
     * @type {number}
     * @private
     */
    bytesRead = 0;

    /**
     * @type {number}
     * @private
     */
    bytesReceived = 0;

    /**
     * @type {boolean}
     * @private
     */
    headerRead = false;

    /**
     * @type {ReadableStream|null}
     * @private
     */
    reader = null;

    /**
     * @type {Uint8Array}
     * @private
     */
    data = new Uint8Array(0);

    /**
     * @type {TextDecoder|null}
     * @private
     */
    decoder = null;

    /**
     * @type {string}
     * @private
     */
    prefix = '';

    /**
     * @type {string}
     * @private
     */
    fileName = '';

    /**
     * @type {number}
     * @private
     */
    fileSize = 0;

    /**
     * @type {string}
     * @private
     */
    fileType = '';

    /**
     * @type {string}
     * @private
     */
    ustarFormat = '';

    /**
     * Create an instance of an Untar.
     *
     * @param {Promise} fetchPromise - A Promise object returned from a fetch request.
     * @param {string} assetsPrefix - Assets registry files prefix.
     * @ignore
     */
    constructor(fetchPromise, assetsPrefix = '') {
        super();
        this.prefix = assetsPrefix || '';
        this.reader = fetchPromise.body.getReader();

        this.reader.read().then((res) => {
            this.pump(res.done, res.value);
        }).catch((err) => {
            this.fire('error', err);
        });
    }

    /**
     * This method is called multiple times when the stream provides data.
     *
     * @param {boolean} done - True when reading data is complete.
     * @param {Uint8Array} value - Chunk of data read from a stream.
     * @returns {Promise|null} Return new pump Promise or null when no more data is available.
     * @ignore
     */
    pump(done, value) {
        if (done) {
            this.fire('done');
            return null;
        }

        this.bytesReceived += value.byteLength;

        const data = new Uint8Array(this.data.length + value.length);
        data.set(this.data);
        data.set(value, this.data.length);
        this.data = data;

        while (this.readFile());

        return this.reader.read().then((res) => {
            this.pump(res.done, res.value);
        }).catch((err) => {
            this.fire('error', err);
        });
    }

    /**
     * Attempt to read file from an available data buffer
     *
     * @returns {boolean} True if file was successfully read and more data is potentially available for
     * processing.
     * @ignore
     */
    readFile() {
        if (!this.headerRead && this.bytesReceived > (this.bytesRead + this.headerSize)) {
            this.headerRead = true;
            const view = new DataView(this.data.buffer, this.bytesRead, this.headerSize);
            this.decoder ??= new TextDecoder('windows-1252');
            const headers = this.decoder.decode(view);

            this.fileName = headers.substring(0, 100).replace(/\0/g, '');
            this.fileSize = parseInt(headers.substring(124, 136), 8);
            this.fileType = headers.substring(156, 157);
            this.ustarFormat = headers.substring(257, 263);

            if (this.ustarFormat.indexOf('ustar') !== -1) {
                const prefix = headers.substring(345, 500).replace(/\0/g, '');
                if (prefix.length > 0) {
                    this.fileName = prefix.trim() + this.fileName.trim();
                }
            }

            this.bytesRead += 512;
        }

        if (this.headerRead) {
            // buffer might be not long enough
            if (this.bytesReceived < (this.bytesRead + this.fileSize)) {
                return false;
            }

            // normal file
            if (this.fileType === '' || this.fileType === '0') {
                const dataView = new DataView(this.data.buffer, this.bytesRead, this.fileSize);

                const file = {
                    name: this.prefix + this.fileName,
                    size: this.fileSize,
                    data: dataView
                };

                this.fire('file', file);
            }

            this.bytesRead += this.fileSize;
            this.headerRead = false;

            // bytes padding
            const bytesRemained = this.bytesRead % this.paddingSize;
            if (bytesRemained !== 0)
                this.bytesRead += this.paddingSize - bytesRemained;

            return true;
        }

        return false;
    }
}

export { Untar };
