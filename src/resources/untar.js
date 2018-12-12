Object.assign(pc, function () {
    var Untar; // see below why we declare this here

    // The UntarScope function is going to be used
    // as the code that ends up in a Web Worker.
    // The Untar variable is declared outside the scope so that
    // we do not have to add a 'return' statement to the UntarScope function.
    // We also have to make sure that we do not mangle 'Untar' variable otherwise
    // the Worker will not work.
    function UntarScope(isWorker) {
        'use strict';

        var utfDecoder;
        var asciiDecoder;

        if (typeof TextDecoder !== 'undefined') {
            utfDecoder = new TextDecoder('utf-8');
            asciiDecoder = new TextDecoder('windows-1252');
        } else {
            console.warn('TextDecoder not supported - pc.Untar module will not work');
        }

        function PaxHeader(fields) {
            this._fields = fields;
        }

        PaxHeader.parse = function (buffer, start, length) {
            var paxArray = new Uint8Array(buffer, start, length);
            var bytesRead = 0;
            var fields = [];

            while (bytesRead < length) {
                var spaceIndex;
                for (spaceIndex = bytesRead; spaceIndex < length; spaceIndex++) {
                    if (paxArray[spaceIndex] == 0x20)
                        break;
                }

                if (spaceIndex >= length) {
                    throw new Error('Invalid PAX header data format.');
                }


                var fieldLength = parseInt(utfDecoder.decode(new Uint8Array(buffer, start + bytesRead, spaceIndex - bytesRead)), 10);
                var fieldText = utfDecoder.decode(new Uint8Array(buffer, start + spaceIndex + 1, fieldLength - (spaceIndex - bytesRead) - 2));
                var field = fieldText.split('=');

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
            for (var i = 0; i < this._fields.length; i++) {
                var fieldName = this._fields[i].name;
                var fieldValue = this._fields[i].value;

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
         * @name pc.Untar
         * @classdesc Untars a tar archive in the form of an array buffer
         * @param {ArrayBuffer} arrayBuffer The array buffer that holds the tar archive
         * @description Creates a new instance of pc.Untar
         */
        var UntarInternal = function (arrayBuffer) {
            this._arrayBuffer = arrayBuffer || new ArrayBuffer(0);
            this._bufferView = new DataView(this._arrayBuffer);
            this._globalPaxHeader = null;
            this._bytesRead = 0;
        };

        if (! isWorker) {
            Untar = UntarInternal;
        }

        /**
         * @private
         * @function
         * @name pc.Untar#_hasNext
         * @description Whether we have more files to untar
         * @returns {Boolean} Returns true or false
         */
        UntarInternal.prototype._hasNext = function () {
            return this._bytesRead + 4 < this._arrayBuffer.byteLength && this._bufferView.getUint32(this._bytesRead) !== 0;
        };

        /**
         * @private
         * @function
         * @name pc.Untar#_readNextFile
         * @description Untars the next file in the archive
         * @returns {Object} Returns a file descriptor in the following format:
         * {name, size, start, url}
         */
        UntarInternal.prototype._readNextFile = function () {
            var headersDataView = new DataView(this._arrayBuffer, this._bytesRead, 512);
            var headers = asciiDecoder.decode(headersDataView);
            this._bytesRead += 512;

            var name = headers.substr(0, 100).replace(/\0/g, '');
            var ustarFormat = headers.substr(257, 6);
            var size = parseInt(headers.substr(124, 12), 8);
            var type = headers.substr(156, 1);
            var start = this._bytesRead;
            var url = null;

            var paxHeader;
            var normalFile = false;
            switch (type) {
                case "0": case "": // Normal file
                    // do not create blob URL if we are in a worker
                    // because if the worker is destroyed it will also destroy the blob URLs
                    normalFile = true;
                    if (!isWorker) {
                        var blob = new Blob([this._arrayBuffer.slice(this._bytesRead, this._bytesRead + size)]);
                        url = URL.createObjectURL(blob);
                    }
                    break;
                case "g": // Global PAX header
                    this._globalPaxHeader = PaxHeader.parse(this._arrayBuffer, this._bytesRead, size);
                    break;
                case "x": // PAX header
                    paxHeader = PaxHeader.parse(this._arrayBuffer, this._bytesRead, size);
                    break;
                case "1": // Link to another file already archived
                case "2": // Symbolic link
                case "3": // Character special device
                case "4": // Block special device
                case "5": // Directory
                case "6": // FIFO special file
                case "7": // Reserved
                default: // Unknown file type
            }

            this._bytesRead += size;

            // File data is padded to reach a 512 byte boundary; skip the padded bytes too.
            var remainder = size % 512;
            if (remainder !== 0) {
                this._bytesRead += (512 - remainder);
            }

            if (! normalFile) {
                return null;
            }

            if (ustarFormat.indexOf("ustar") !== -1) {
                var namePrefix = headers.substr(345, 155).replace(/\0/g, '');

                if (namePrefix.length > 0) {
                    name = namePrefix.trim() + name.trim();
                }
            }

            var file = {
                name: name,
                start: start,
                size: size,
                url: url
            };

            if (this._globalPaxHeader) {
                this._globalPaxHeader.applyHeader(file);
            }

            if (paxHeader) {
                paxHeader.applyHeader(file);
            }

            return file;
        };

        /**
         * @private
         * @function
         * @name pc.Untar#untar
         * @description Untars the array buffer provided in the constructor.
         * @param {String} [filenamePrefix] The prefix for each filename in the tar archive. This is usually the {@link pc.AssetRegistry} prefix.
         * @returns {Object[]} An array of files in this format {name, start, size, url}
         */
        UntarInternal.prototype.untar = function (filenamePrefix) {
            if (! utfDecoder) {
                console.error('Cannot untar because TextDecoder interface is not available for this platform.');
                return [];
            }

            var files = [];
            while (this._hasNext()) {
                var file = this._readNextFile();
                if (! file) continue;
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
                var id = e.data.id;

                try {
                    var archive = new UntarInternal(e.data.arrayBuffer);
                    var files = archive.untar(e.data.prefix);
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

    // Convert the UntarScope function to a string and add
    // the onmessage handler for the worker to untar archives
    var scopeToUrl = function () {
        // execute UntarScope function in the worker
        var code = '(' + UntarScope.toString() + ')(true)\n\n';

        // create blob URL for the code above to be used for the worker
        var blob = new Blob([code], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    };

    // this is the URL that is going to be used for workers
    var WORKER_URL = scopeToUrl();

    /**
    * @private
    * @name pc.UntarWorker
    * @classdesc Wraps untar'ing a tar archive with a Web Worker.
    * @description Creates new instance of a pc.UntarWorker.
    * @param {String} [filenamePrefix] The prefix that should be added to each file name in the archive. This is usually the {@link pc.AssetRegistry} prefix.
    */
    var UntarWorker = function (filenamePrefix) {
        this._requestId = 0;
        this._pendingRequests = {};
        this._filenamePrefix = filenamePrefix;
        this._worker = new Worker(WORKER_URL);
        this._worker.addEventListener('message', this._onMessage.bind(this));
    };

    UntarWorker.prototype._onMessage = function (e) {
        var id = e.data.id;
        if (! this._pendingRequests[id]) return;

        var callback = this._pendingRequests[id];

        delete this._pendingRequests[id];

        if (e.data.error) {
            callback(e.data.error);
        } else {
            var arrayBuffer = e.data.arrayBuffer;

            // create blob URLs for each file. We are creating the URLs
            // here - outside of the worker - so that the main thread owns them
            for (var i = 0, len = e.data.files.length; i < len; i++) {
                var file = e.data.files[i];
                var blob = new Blob([arrayBuffer.slice(file.start, file.start + file.size)]);
                file.url = URL.createObjectURL(blob);
            }

            callback(null, e.data.files);
        }
    };

    /**
     * @private
     * @function
     * @name pc.UntarWorker#untar
     * @description Untars the specified array buffer using a Web Worker and returns the result in the callback.
     * @param {ArrayBuffer} arrayBuffer The array buffer that holds the tar archive.
     * @param {Function} callback The callback function called when the worker is finished or if there is an error. The
     * callback has the following arguments: {error, files}, where error is a string if any, and files is an array of file descriptors
     */
    UntarWorker.prototype.untar = function (arrayBuffer, callback) {
        var id = this._requestId++;
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
    };

    /**
     * @private
     * @function
     * @name pc.UntarWorker#hasPendingRequests
     * @description Returns whether the worker has pending requests to untar array buffers
     * @returns {Boolean} Returns true of false
     */
    UntarWorker.prototype.hasPendingRequests = function () {
        for (var key in this._pendingRequests) {
            return true;
        }

        return false;
    };

    /**
     * @private
     * @function
     * @name pc.UntarWorker#destroy
     * @description Destroys the internal Web Worker
     */
    UntarWorker.prototype.destroy = function () {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;

            this._pendingRequests = null;
        }
    };

    // execute the UntarScope function in order to declare the Untar constructor
    UntarScope();

    // expose variables to the pc namespace
    return {
        Untar: Untar,
        UntarWorker: UntarWorker
    };
}());
