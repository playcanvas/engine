Object.assign(pc, function () {

    var BasisWorker = function (jsUrl, binaryUrl, asmUrl, formats) {

        // check for wasm module support
        var wasmSupported = (function () {
            try {
                if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
                    var module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
                    if (module instanceof WebAssembly.Module)
                        return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
                }
            } catch (e) { }
            return false;
        })();

        // load the basis wasm module
        var loadBasisModule = function (doneCallback) {
            var params = {
                locateFile: function () {
                    return binaryUrl;
                }
            };
            self.importScripts(wasmSupported ? jsUrl : asmUrl);
            self.BASIS(params).then( function (instance) {
                self[BASIS] = instance;
                doneCallback(instance);
            } );
        };

        // download the specified file and give it to the callback
        var download = function (url, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.withCredentials = false;
            xhr.responseType = "arraybuffer";

            xhr.onerror = function () {
                callback(xhr.status === 0 ? 'Network error' : xhr.status, null);
            };

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if ([200, 201, 206, 304].indexOf(xhr.status) !== -1) {
                        callback(null, xhr.response);
                    } else {
                        callback(xhr.status === 0 ? 'Network error' : xhr.status, null);
                    }
                }
            };

            xhr.send(postdata);

            return xhr;
        };

        // transcode the blob of binary data into a render-ready texture asset
        var transcode = function (data) {
            var basisFile = new BASIS.BasisFile(new Uint8Array(data));

            var width = basisFile.getImageWidth(0, 0);
            var height = basisFile.getImageHeight(0, 0);
            var images = basisFile.getNumImages();
            var levels = basisFile.getNumLevels(0);
            var hasAlpha = !!basisFile.getHasAlpha();

            if (!width || !height || !images || !levels) {
                basisFile.close();
                basisFile.delete();
                throw new Error('Invalid image dimensions');
            }

            // select format based on supported formats
            var format = formats[hasAlpha ? 0 : 1];

            console.log('width=' + width + ' height=' + height + ' levels=' + levels + ' format=' + format);

            if (!basisFile.startTranscoding()) {
                basisFile.close();
                basisFile.delete();
                throw new Error('Failed to start transcoding');
            }

            var levelData = [];
            for (var mip = 0; mip < levels; ++mip) {
                var dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, format);
                var dst = new Uint8Array(dstSize);

                if (!basisFile.transcodeImage(dst, 0, mip, format, 1, 0)) {
                    basisFile.close();
                    basisFile.delete();
                    throw new Error('Failed to transcode image');
                }

                var i;
                if (format === 14 /* BASIS_FORMAT.cTFRGB565 */ || format === 16 /* BASIS_FORMAT.cTFRGBA4444 */) {
                    // 16 bit formats require Uint16 typed array
                    var dst16 = new Uint16Array(dstSize / 2);
                    for (i = 0; i < dstSize / 2; ++i) {
                        dst16[i] = dst[i * 2] + dst[i * 2 + 1] * 256;
                    }
                    dst = dst16;
                }

                levelData.push(dst);
            }

            basisFile.close();
            basisFile.delete();

            return {
                format: format,
                width: (width + 3) & ~3,
                height: (height + 3) & ~3,
                levels: levelData,
                cubemap: false,
                mipmaps: true
            };
        };

        // send result to the caller
        var send = function (url, data) {
            self.postMessage( { url: url, data: data }, [data.levels]);
        };

        // download and transcode the file given the basis module and
        // file url
        var handle = function (basis, url) {
            try {
                download(url, function (err, response) {
                    if (err) {
                        throw new Error(err);
                    }
                    send(url, transcode(basis, response));
                });
            } catch (err) {
                self.postMessage( { err: err } );
            }
        };

        var basis = null;
        var queue = [];

        // handle incoming request to download and transcode
        self.onmessage = function (message) {
            if (basis) {
                handle(basis, message.url);
            } else {
                queue.push(message.url);
            }
        };

        // load basis transcoder at start of web worker
        loadBasisModule( function (instance) {
            basis = instance;
            basis.initializeBasis();
            for (var i = 0; i < queue.length; ++i) {
                handle(basis, queue[i]);
            }
        });
    };

    var BASIS_FORMAT = {
        cTFETC1: 0,                         // etc1
        cTFETC2: 1,                         // etc2
        cTFBC1: 2,                          // dxt1
        cTFBC3: 3,                          // dxt5
        cTFPVRTC1_4_RGB: 8,                 // PVRTC1 rgb
        cTFPVRTC1_4_RGBA: 9,                // PVRTC1 rgba
        cTFASTC_4x4: 10,                    // ASTC
        cTFATC_RGB: 11,                     // ATC rgb
        cTFATC_RGBA_INTERPOLATED_ALPHA: 12, // ATC rgba

        // uncompressed (fallback) formats
        cTFRGB565: 14,          // rgb 565
        cTFRGBA4444: 16         // rgbq 4444
    };

    var Basis = function () {
        this.worker = null;
        this.callbacks = { };
    };

    // render thread worker manager
    Basis.prototype = {
        getAndPrepare: function (url, callback) {
            if (this.worker === null) {
                this._init();
            }

            if (!this.callbacks.hasOwnProperty(url)) {
                // store url and kick off worker job
                this.callbacks[url] = [callback];
                console.log('posting message for url=' + url);
                this.worker.postMessage({ url: url });
            } else {
                // the basis worker is already busy processing this url, store callback
                // (this shouldn't really happen since the asset system only requests
                // a resource once)
                this.callbacks[url].push(callback);
            }
        },

        _init: function () {
            // create a set of two formats, one for the alpha and one for the non-alpha
            // basis formats
            var formats = (function (device) {
                if (device.extCompressedTextureASTC) {
                    return [BASIS_FORMAT.cTFASTC_4x4, BASIS_FORMAT.cTFASTC_4x4];
                } else if (device.extCompressedTextureS3TC) {
                    return [BASIS_FORMAT.cTFBC3, BASIS_FORMAT.cTFBC1];
                } else if (device.extCompressedTextureETC) {                    // TODO: does the presence of etc support imply etc1 support?
                    return [BASIS_FORMAT.cTFETC2, BASIS_FORMAT.cTFETC1];
                } else if (device.extCompressedTextureETC1) {
                    return [BASIS_FORMAT.cTFRGBA4444, BASIS_FORMAT.cTFETC1];    // TODO: fallback to 4444 or 8888?
                } else if (device.extCompressedTexturePVRTC) {
                    return [BASIS_FORMAT.cTFPVRTC1_4_RGBA, BASIS_FORMAT.cTFPVRTC1_4_RGB];
                } else if (device.extCompressedTextureATC) {
                    return [BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA, BASIS_FORMAT.cTFATC_RGB];
                }
                return [BASIS_FORMAT.cTFRGBA4444, BASIS_FORMAT.cTFRGB565];
            })(pc.app.graphicsDevice);

            var code = '(' + BasisWorker.toString() + ')(' + formats.toString() + ')\n\n';
            var blob = new Blob([code], { type: 'application/javascript' });
            var url = URL.createObjectURL(blob);
            this.worker = new Worker(url);
            this.worker.addEventListener(this._handleWorkerResponse);
        },

        _handleWorkerResponse: function (message) {
            var callbacks = this.callbacks[message.url];
            if (callbacks) {
                for (var i = 0; i < callbacks.length; ++i) {
                    if (message.err) {
                        (callbacks[i])(message.err);
                    } else {
                        // convert basis to pixel format
                        message.data.format = this._basisToPixelFormat(message.data.format);
                        (callbacks[i])(null, message.data);
                    }
                }
            } else {
                // should never happen
                console.error('internal logical error encountered');
            }
        },

        _basisToPixelFormat: function (format) {
            switch (format) {
                case BASIS_FORMAT.cTFETC1: return pc.PIXELFORMAT_ETC1;
                case BASIS_FORMAT.cTFETC2: return pc.PIXELFORMAT_ETC2_RGBA;
                case BASIS_FORMAT.cTFBC1: return pc.PIXELFORMAT_DXT1;
                case BASIS_FORMAT.cTFBC3: return pc.PIXELFORMAT_DXT5;
                case BASIS_FORMAT.cTFPVRTC1_4_RGB: return pc.PIXELFORMAT_PVRTC_4BPP_RGB_1;
                case BASIS_FORMAT.cTFPVRTC1_4_RGBA: return pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1;
                case BASIS_FORMAT.cTFASTC_4x4: return pc.PIXELFORMAT_ASTC_4x4;
                case BASIS_FORMAT.cTFATC_RGB: return pc.PIXELFORMAT_ATC_RGB;
                case BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA: return pc.PIXELFORMAT_ATC_RGBA;
                case BASIS_FORMAT.cTFRGB565: return pc.PIXELFORMAT_R5_G6_B5;
                case BASIS_FORMAT.cTFRGBA4444: return pc.PIXELFORMAT_R4_G4_B4_A4;
            }
        }
    };

    var BasisParser = function (data) {
        return data;
    };

    return {
        Basis: new Basis(),
        BasisParser: BasisParser
    };
}());
