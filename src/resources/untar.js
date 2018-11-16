Object.assign(pc, function () {
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

    function Untar(arrayBuffer) {
        this._arrayBuffer = arrayBuffer || new ArrayBuffer(0);
        this._bufferView = new DataView(this._arrayBuffer);
        this._globalPaxHeader = null;
        this._bytesRead = 0;
    }

    Untar.prototype.hasNext = function () {
        return this._bytesRead + 4 < this._arrayBuffer.byteLength && this._bufferView.getUint32(this._bytesRead) !== 0;
    };

    Untar.prototype.readNextFile = function () {
        var headersDataView = new DataView(this._arrayBuffer, this._bytesRead, 512);
        var headers = asciiDecoder.decode(headersDataView);
        this._bytesRead += 512;

        var file = {
            name: headers.substr(0, 100),
            mode: headers.substr(100, 8),
            uid: parseInt(headers.substr(108, 8), 10),
            gid: parseInt(headers.substr(116, 8), 10),
            size: parseInt(headers.substr(124, 12), 8),
            mtime: parseInt(headers.substr(136, 12), 8),
            checksum: parseInt(headers.substr(148, 8), 10),
            type: headers.substr(156, 1),
            linkname: headers.substr(157, 100),
            ustarFormat: headers.substr(257, 6)
        };

        if (file.ustarFormat.indexOf("ustar") > -1) {
            file.version = headers.substr(263, 2);
            file.uname = headers.substr(265, 32);
            file.gname = headers.substr(297, 32);
            file.devmajor = parseInt(headers.substr(329, 8), 10);
            file.devminor = parseInt(headers.substr(337, 8), 10);
            file.namePrefix = headers.substr(345, 155);

            if (file.namePrefix.length > 0) {
                file.name = file.namePrefix.trim() + file.name.trim();
            }
        }

        var paxHeader;
        var readPaxHeader = false;
        switch (file.type) {
            case "0": case "": // Normal file
                var blob = new Blob([this._arrayBuffer.slice(this._bytesRead, this._bytesRead + file.size)]);
                file.url = URL.createObjectURL(blob);
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

        return file;
    };

    return {
        Untar: Untar
    };
}());
