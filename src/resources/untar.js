let Untar; // see below why we declare this here

// The UntarScope function is going to be used
// as the code that ends up in a Web Worker.
// The Untar variable is declared outside the scope so that
// we do not have to add a 'return' statement to the UntarScope function.
// We also have to make sure that we do not mangle 'Untar' variable otherwise
// the Worker will not work.
function UntarScope(isWorker) {
    let utfDecoder;
    let asciiDecoder;

    if (typeof TextDecoder !== 'undefined') {
        try {
            utfDecoder = new TextDecoder('utf-8');
            asciiDecoder = new TextDecoder('windows-1252');
        } catch (e) {
            console.warn('TextDecoder not supported - pc.Untar module will not work');
        }
    } else {
        console.warn('TextDecoder not supported - pc.Untar module will not work');
    }

    function PaxHeader(fields) {
        this._fields = fields;
    }

    PaxHeader.parse = function (buffer, start, length) {
        const paxArray = new Uint8Array(buffer, start, length);
        let bytesRead = 0;
        const fields = [];

        while (bytesRead < length) {
            let spaceIndex;
            for (spaceIndex = bytesRead; spaceIndex < length; spaceIndex++) {
                if (paxArray[spaceIndex] === 0x20)
                    break;
            }

            if (spaceIndex >= length) {
                throw new Error('Invalid PAX header data format.');
            }

            const fieldLength = parseInt(utfDecoder.decode(new Uint8Array(buffer, start + bytesRead, spaceIndex - bytesRead)), 10);
            const fieldText = utfDecoder.decode(new Uint8Array(buffer, start + spaceIndex + 1, fieldLength - (spaceIndex - bytesRead) - 2));
            const field = fieldText.split('=');

            if (field.length !== 2) {
                throw new Error('Invalid PAX header data format.');
            }

            if (field[1].length === 0) {
                field[1] = null;
            }

            fields.push({
                name: field[0],
                value: field[1]
            });

            bytesRead += fieldLength;
        }

        return new PaxHeader(fields);
    };

    PaxHeader.prototype.applyHeader = function (file) {
        for (let i = 0; i < this._fields.length; i++) {
            let fieldName = this._fields[i].name;
            const fieldValue = this._fields[i].value;

            if (fieldName === 'path') {
                fieldName = 'name';
            }

            if (fieldValue === null) {
                delete file[fieldName];
            } else {
                file[fieldName] = fieldValue;
            }
        }
    };

    /**
     * @private
     * @name Untar
     * @classdesc Untars a tar archive in the form of an array buffer.
     * @param {ArrayBuffer} arrayBuffer - The array buffer that holds the tar archive.
     * @description Creates a new instance of Untar.
     */
    function UntarInternal(arrayBuffer) {
        this._arrayBuffer = arrayBuffer || new ArrayBuffer(0);
        this._bufferView = new DataView(this._arrayBuffer);
        this._globalPaxHeader = null;
        this._paxHeader = null;
        this._bytesRead = 0;
    }

    if (!isWorker) {
        Untar = UntarInternal;
    }

    /**
     * @private
     * @function
     * @name Untar#_hasNext
     * @description Whether we have more files to untar.
     * @returns {boolean} Returns true or false.
     */
    UntarInternal.prototype._hasNext = function () {
        return this._bytesRead + 4 < this._arrayBuffer.byteLength && this._bufferView.getUint32(this._bytesRead) !== 0;
    };

    /**
     * @private
     * @function
     * @name Untar#_readNextFile
     * @description Untars the next file in the archive.
     * @returns {object} Returns a file descriptor in the following format:
     * {name, size, start, url}.
     */
    UntarInternal.prototype._readNextFile = function () {
        const headersDataView = new DataView(this._arrayBuffer, this._bytesRead, 512);
        const headers = asciiDecoder.decode(headersDataView);
        this._bytesRead += 512;

        let name = headers.substring(0, 100).replace(/\0/g, '');
        const ustarFormat = headers.substring(257, 263);
        const size = parseInt(headers.substring(124, 136), 8);
        const type = headers.substring(156, 157);
        const start = this._bytesRead;
        let url = null;

        let normalFile = false;
        switch (type) {
            case '0': case '': // Normal file
                // do not create blob URL if we are in a worker
                // because if the worker is destroyed it will also destroy the blob URLs
                normalFile = true;
                if (!isWorker) {
                    const blob = new Blob([this._arrayBuffer.slice(this._bytesRead, this._bytesRead + size)]);
                    url = URL.createObjectURL(blob);
                }
                break;
            case 'g': // Global PAX header
                this._globalPaxHeader = PaxHeader.parse(this._arrayBuffer, this._bytesRead, size);
                break;
            case 'x': // PAX header
                this._paxHeader = PaxHeader.parse(this._arrayBuffer, this._bytesRead, size);
                break;
            case '1': // Link to another file already archived
            case '2': // Symbolic link
            case '3': // Character special device
            case '4': // Block special device
            case '5': // Directory
            case '6': // FIFO special file
            case '7': // Reserved
            default: // Unknown file type
        }

        this._bytesRead += size;

        // File data is padded to reach a 512 byte boundary; skip the padded bytes too.
        const remainder = size % 512;
        if (remainder !== 0) {
            this._bytesRead += (512 - remainder);
        }

        if (!normalFile) {
            return null;
        }

        if (ustarFormat.indexOf('ustar') !== -1) {
            const namePrefix = headers.substring(345, 500).replace(/\0/g, '');

            if (namePrefix.length > 0) {
                name = namePrefix.trim() + name.trim();
            }
        }

        const file = {
            name: name,
            start: start,
            size: size,
            url: url
        };

        if (this._globalPaxHeader) {
            this._globalPaxHeader.applyHeader(file);
        }

        if (this._paxHeader) {
            this._paxHeader.applyHeader(file);
            this._paxHeader = null;
        }

        return file;
    };

    /**
     * @private
     * @function
     * @name Untar#untar
     * @description Untars the array buffer provided in the constructor.
     * @param {string} [filenamePrefix] - The prefix for each filename in the tar archive. This is usually the {@link AssetRegistry} prefix.
     * @returns {object[]} An array of files in this format {name, start, size, url}.
     */
    UntarInternal.prototype.untar = function (filenamePrefix) {
        if (!utfDecoder) {
            console.error('Cannot untar because TextDecoder interface is not available for this platform.');
            return [];
        }

        const files = [];
        while (this._hasNext()) {
            const file = this._readNextFile();
            if (!file) continue;
            if (filenamePrefix && file.name) {
                file.name = filenamePrefix + file.name;
            }
            files.push(file);
        }

        return files;
    };

    // if we are in a worker then create the onmessage handler using worker.self
    if (isWorker) {
        self.onmessage = function (e) {
            const id = e.data.id;

            try {
                const archive = new UntarInternal(e.data.arrayBuffer);
                const files = archive.untar(e.data.prefix);
                // The worker is done so send a message to the main thread.
                // Notice we are sending the array buffer back as a Transferrable object
                // so that the main thread can re-assume control of the array buffer.
                postMessage({
                    id: id,
                    files: files,
                    arrayBuffer: e.data.arrayBuffer
                }, [e.data.arrayBuffer]);
            } catch (err) {
                postMessage({
                    id: id,
                    error: err.toString()
                });
            }
        };
    }
}

// this is the URL that is going to be used for workers
let workerUrl = null;

// Convert the UntarScope function to a string and add
// the onmessage handler for the worker to untar archives
function getWorkerUrl() {
    if (!workerUrl) {
        // execute UntarScope function in the worker
        const code = '(' + UntarScope.toString() + ')(true)\n\n';

        // create blob URL for the code above to be used for the worker
        const blob = new Blob([code], { type: 'application/javascript' });

        workerUrl = URL.createObjectURL(blob);
    }
    return workerUrl;
}

/**
 * Wraps untar'ing a tar archive with a Web Worker.
 *
 * @ignore
 */
class UntarWorker {
    /**
     * Creates new instance of an UntarWorker.
     *
     * @param {string} [filenamePrefix] - The prefix that should be added to each file name in the
     * archive. This is usually the {@link AssetRegistry} prefix.
     */
    constructor(filenamePrefix) {
        this._requestId = 0;
        this._pendingRequests = {};
        this._filenamePrefix = filenamePrefix;
        this._worker = new Worker(getWorkerUrl());
        this._worker.addEventListener('message', this._onMessage.bind(this));
    }

    /**
     * @param {MessageEvent} e - The message event from the worker.
     * @private
     */
    _onMessage(e) {
        const id = e.data.id;
        if (!this._pendingRequests[id]) return;

        const callback = this._pendingRequests[id];

        delete this._pendingRequests[id];

        if (e.data.error) {
            callback(e.data.error);
        } else {
            const arrayBuffer = e.data.arrayBuffer;

            // create blob URLs for each file. We are creating the URLs
            // here - outside of the worker - so that the main thread owns them
            for (let i = 0, len = e.data.files.length; i < len; i++) {
                const file = e.data.files[i];
                const blob = new Blob([arrayBuffer.slice(file.start, file.start + file.size)]);
                file.url = URL.createObjectURL(blob);
            }

            callback(null, e.data.files);
        }
    }

    /**
     * Untars the specified array buffer using a Web Worker and returns the result in the callback.
     *
     * @param {ArrayBuffer} arrayBuffer - The array buffer that holds the tar archive.
     * @param {Function} callback - The callback function called when the worker is finished or if
     * there is an error. The callback has the following arguments: {error, files}, where error is
     * a string if any, and files is an array of file descriptors.
     */
    untar(arrayBuffer, callback) {
        const id = this._requestId++;
        this._pendingRequests[id] = callback;

        // send data to the worker - notice the last argument
        // converts the arrayBuffer to a Transferrable object
        // to avoid copying the array buffer which would cause a stall.
        // However this causes the worker to assume control of the array
        // buffer so we cannot access this buffer until the worker is done with it.
        this._worker.postMessage({
            id: id,
            prefix: this._filenamePrefix,
            arrayBuffer: arrayBuffer
        }, [arrayBuffer]);
    }

    /**
     * Returns whether the worker has pending requests to untar array buffers.
     *
     * @returns {boolean} Returns true if there are pending requests and false otherwise.
     */
    hasPendingRequests() {
        return Object.keys(this._pendingRequests).length > 0;
    }

    /**
     * Destroys the internal Web Worker.
     */
    destroy() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;

            this._pendingRequests = null;
        }
    }
}

// execute the UntarScope function in order to declare the Untar constructor
UntarScope();

export { Untar, UntarWorker };
