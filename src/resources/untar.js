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

        var utfDecoder = new TextDecoder('utf-8');
        var asciiDecoder = new TextDecoder('windows-1252');

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
        Untar = function (arrayBuffer) {
            this._arrayBuffer = arrayBuffer || new ArrayBuffer(0);
            this._bufferView = new DataView(this._arrayBuffer);
            this._globalPaxHeader = null;
            this._bytesRead = 0;
        };

        /**
         * @private
         * @function
         * @name pc.Untar#hasNext
         * @description Whether we have more files to untar
         * @returns {Boolean} Returns true or false
         */
        Untar.prototype.hasNext = function () {
            return this._bytesRead + 4 < this._arrayBuffer.byteLength && this._bufferView.getUint32(this._bytesRead) !== 0;
        };

        /**
         * @private
         * @function
         * @name pc.Untar#readNextFile
         * @description Untars the next file in the archive
         * @returns {Object} Returns a file descriptor in the following format:
         * {name, size, type, ustarFormat, start, end}
         */
        Untar.prototype.readNextFile = function () {
            var headersDataView = new DataView(this._arrayBuffer, this._bytesRead, 512);
            var headers = asciiDecoder.decode(headersDataView);
            this._bytesRead += 512;

            var file = {
                name: headers.substr(0, 100).replace(/\0/g, ''),
                // mode: headers.substr(100, 8),
                // uid: parseInt(headers.substr(108, 8), 10),
                // gid: parseInt(headers.substr(116, 8), 10),
                size: parseInt(headers.substr(124, 12), 8),
                // mtime: parseInt(headers.substr(136, 12), 8),
                // checksum: parseInt(headers.substr(148, 8), 10),
                type: headers.substr(156, 1),
                // linkname: headers.substr(157, 100),
                ustarFormat: headers.substr(257, 6),
                start: this._bytesRead,
                end: this._bytesRead
            };

            file.end += file.size;

            if (file.ustarFormat.indexOf("ustar") > -1) {
                // file.version = headers.substr(263, 2);
                // file.uname = headers.substr(265, 32);
                // file.gname = headers.substr(297, 32);
                // file.devmajor = parseInt(headers.substr(329, 8), 10);
                // file.devminor = parseInt(headers.substr(337, 8), 10);
                file.namePrefix = headers.substr(345, 155).replace(/\0/g, '');

                if (file.namePrefix.length > 0) {
                    file.name = file.namePrefix.trim() + file.name.trim();
                }
            }

            var paxHeader;
            var readPaxHeader = false;
            switch (file.type) {
                case "0": case "": // Normal file
                    // do not create blob URL if we are in a worker
                    // because if the worker is destroyed it will also destroy the blob URLs
                    if (!isWorker) {
                        var blob = new Blob([this._arrayBuffer.slice(this._bytesRead, this._bytesRead + file.size)]);
                        file.url = URL.createObjectURL(blob);
                    }
                    break;
                case "g": // Global PAX header
                    this._globalPaxHeader = PaxHeader.parse(this._arrayBuffer, this._bytesRead, file.size);
                    readPaxHeader = true;
                    break;
                case "x": // PAX header
                    paxHeader = PaxHeader.parse(this._arrayBuffer, this._bytesRead, file.size);
                    readPaxHeader = true;
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

            this._bytesRead += file.size;

            // File data is padded to reach a 512 byte boundary; skip the padded bytes too.
            var remainder = file.size % 512;
            if (remainder !== 0) {
                this._bytesRead += (512 - remainder);
            }

            if (readPaxHeader) {
                file = this.readNextFile();
            }

            if (this._globalPaxHeader) {
                this._globalPaxHeader.applyHeader(file);
            }

            if (paxHeader) {
                paxHeader.applyHeader(file);
            }

            if (file.name) {
                file.name = file.name.replace(/\0/g, '');
            }

            return file;
        };

        if (isWorker) {
            self.onmessage = function (e) {
                try {
                    var untar = new Untar(e.data.arrayBuffer);
                    var files = [];
                    var prefix = e.data.prefix;
                    while (untar.hasNext()) {
                        var file = untar.readNextFile();
                        if (prefix && file.name) {
                            file.name = prefix + file.name;
                        }
                        files.push(file);
                    }
                    postMessage({ files: files });
                } catch (err) {
                    postMessage({ error: err.toString() });
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
    * @param {pc.AssetRegistry} assets The asset registry.
    */
    var UntarWorker = function (assets) {
        this._assets = assets;
        this._pendingRequests = 0;
        this._worker = new Worker(WORKER_URL);
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
        this._pendingRequests++;
        var onmessage = function (e) {
            this._worker.removeEventListener('message', onmessage);
            this._pendingRequests--;
            if (e.data.error) {
                callback(e.data.error);
            } else {
                // create blob URLs for each file. We are creating the URLs
                // here - outside of the worker - so that the main thread owns them
                for (var i = 0, len = e.data.files.length; i < len; i++) {
                    var file = e.data.files[i];
                    if (file.type === '0' || file.type === '') {
                        var blob = new Blob([arrayBuffer.slice(file.start, file.end)]);
                        file.url = URL.createObjectURL(blob);
                    }
                }

                callback(null, e.data.files);
            }
        }.bind(this);
        this._worker.addEventListener('message', onmessage);
        this._worker.postMessage({
            prefix: this._assets.prefix,
            arrayBuffer: arrayBuffer
        });
    };

    /**
     * @private
     * @function
     * @name pc.UntarWorker#hasPendingRequests
     * @description Returns whether the worker has pending requests to untar array buffers
     * @returns {Boolean} Returns true of false
     */
    UntarWorker.prototype.hasPendingRequests = function () {
        return this._pendingRequests > 0;
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
