Object.assign(pc, function () {

    var BasisWorker = function (worker, jsUrl, binaryUrl, asmUrl, formats) {

        // transcode the basis super-compressed data into one of the runtime gpu native formats
        var transcode = function (basis, url, data) {
            var funcStart = performance.now();
            var basisFile = new basis.BasisFile(new Uint8Array(data));

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

            // console.log('width=' + width + ' height=' + height + ' levels=' + levels + ' format=' + format);

            return {
                format: format,
                width: (width + 3) & ~3,
                height: (height + 3) & ~3,
                levels: levelData,
                cubemap: false,
                mipmaps: true,
                transcodeTime: performance.now() - funcStart,
                url: url
            };
        };

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

        var params = {
            locateFile: function () {
                return binaryUrl;
            }
        };
        var basis = null;
        var queue = [];

        if (worker) {
            // download and transcode the file given the basis module and
            // file url
            var handler = function (url, data) {
                if (basis) {
                    try {
                        // texture data has been provided
                        var result = transcode(basis, url, data);
                        result.levels = result.levels.map(function (v) {
                            return v.buffer;
                        });
                        self.postMessage( { url: url, data: result }, result.levels);
                    } catch (err) {
                        self.postMessage( { url: url, err: err } );
                    }
                } else {
                    queue.push([url, data]);
                }
            };

            // load basis transcoder
            self.importScripts(wasmSupported ? jsUrl : asmUrl);
            self.BASIS(params).then( function (instance) {
                basis = instance;
                basis.initializeBasis();
                for (var i = 0; i < queue.length; ++i) {
                    handler(queue[i][0], queue[i][1]);
                }
                queue = null;
            });

            // handle incoming worker requests
            self.onmessage = function (message) {
                handler(message.data.url, message.data.data);
            };
        } else {
            var loadScriptAsync = function (url, callback) {
                var tag = document.createElement('script');
                tag.onload = function () {
                    callback();
                };
                tag.onerror = function () {
                    throw new Error('failed to load ' + url);
                };
                tag.async = true;
                tag.src = url;
                document.head.appendChild(tag);
            };

            var loadWasmModuleAsync = function (moduleName, jsUrl, binaryUrl, callback) {
                loadScriptAsync(jsUrl, function () {
                    window[moduleName](params).then( function (instance) {
                        callback(instance);
                    });
                });
            };

            var inlineHandler = function (url, data, callback) {
                if (basis) {
                    try {
                        callback(null, transcode(basis, url, data));
                    } catch (err) {
                        callback(err, null);
                    }
                } else {
                    queue.push([url, data, callback]);
                }
            };

            loadWasmModuleAsync('BASIS', wasmSupported ? jsUrl : asmUrl, binaryUrl, function (instance) {
                basis = instance;
                basis.initializeBasis();
                for (var i = 0; i < queue.length; ++i) {
                    inlineHandler(queue[i][0], queue[i][1], queue[i][2]);
                }
                queue = null;
            });

            // not running in a worker, caller can use the handler directly
            return inlineHandler;
        }
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
        this.transcoder = null;
        this.callbacks = { };
        this.urlBase = (window.ASSET_PREFIX ? window.ASSET_PREFIX : (window.location.origin + '/'));

        // given the device's texture compression support, select the basis texture format to use
        // for alpha and opaque textures and also the version of the basis module to load and use.
        // returns [basis semitrans format, basis opaque format, flavour of basis module required]
        var formats = (function (device) {
            // these are tested in order of priority
            if (device.extCompressedTextureASTC) {
                return [BASIS_FORMAT.cTFASTC_4x4, BASIS_FORMAT.cTFASTC_4x4, 'astc'];
            } else if (device.extCompressedTextureS3TC) {
                return [BASIS_FORMAT.cTFBC3, BASIS_FORMAT.cTFBC1, 'dxt'];
            } else if (device.extCompressedTextureETC) {                    // TODO: does the presence of etc support imply etc1 support?
                return [BASIS_FORMAT.cTFETC2, BASIS_FORMAT.cTFETC1, 'etc2'];
            } else if (device.extCompressedTextureETC1) {
                return [BASIS_FORMAT.cTFRGBA4444, BASIS_FORMAT.cTFETC1, 'etc1'];    // TODO: fallback to 4444 or 8888?
            } else if (device.extCompressedTexturePVRTC) {
                return [BASIS_FORMAT.cTFPVRTC1_4_RGBA, BASIS_FORMAT.cTFPVRTC1_4_RGB, 'pvr'];
            } else if (device.extCompressedTextureATC) {
                return [BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA, BASIS_FORMAT.cTFATC_RGB, 'atc'];
            }
            return [BASIS_FORMAT.cTFRGBA4444, BASIS_FORMAT.cTFRGB565, 'etc1'];
        })(pc.app.graphicsDevice);

        // search for wasm module
        var modules = (window.config ? window.config.wasmModules : window.PRELOAD_MODULES) || [];
        var moduleName = 'basist_' + formats[2];
        var wasmModule = modules.find(function (m) {
            return m.wasmUrl.indexOf(moduleName) !== -1;
        });
        if (!wasmModule) {
            wasmModule = modules.find(function (m) {
                return m.wasmUrl.indexOf('basist_all') !== -1;
            });
        }

        if (pc.platform.workers) {
            var code = '(' + BasisWorker.toString() + ')(' +
                        'true,"' +
                        this.urlBase + wasmModule.glueUrl + '","' +
                        this.urlBase + wasmModule.wasmUrl + '","' +
                        this.urlBase + wasmModule.fallbackUrl + '",' +
                        '[' + formats.slice(0, 2).toString() + ']' +
                        ')\n\n';
            var blob = new Blob([code], { type: 'application/javascript' });
            var url = URL.createObjectURL(blob);
            this.worker = new Worker(url);
            this.worker.addEventListener('message', this._handleWorkerResponse.bind(this));
        } else {
            this.transcoder = new BasisWorker(
                false,
                this.urlBase + wasmModule.glueUrl,
                this.urlBase + wasmModule.wasmUrl,
                this.urlBase + wasmModule.fallbackUrl,
                formats.slice(0, 2));
        }
    };

    // render thread worker manager
    Basis.prototype = {
        transcode: function (url, data, callback) {
            if (this._isUrlRelative(url)) {
                url = this.urlBase + url;
            }
            if (this.worker) {
                if (!this.callbacks.hasOwnProperty(url)) {
                    // store url and kick off worker job
                    this.callbacks[url] = [callback];
                    this.worker.postMessage({ url: url, data: data }, [data]);
                } else {
                    // the basis worker is already busy processing this url, store callback
                    // (this shouldn't really happen since the asset system only requests
                    // a resource once)
                    this.callbacks[url].push(callback);
                }
            } else {
                this.transcoder(url, data, function (err, data) {
                    if (err) {
                        callback(err, null);
                    } else {
                        data.format = this._basisToPixelFormat(data.format);
                        callback(null, data);
                    }
                }.bind(this));
            }
        },

        _isUrlRelative: function (url) {
            return (url.indexOf('://')  <= 0 && url.indexOf('//') !== 0 );
        },

        _handleWorkerResponse: function (message) {
            var url = message.data.url;
            var err = message.data.err;
            var data = message.data.data;
            var callbacks = this.callbacks[url];

            if (!callbacks) {
                console.error('internal logical error encountered');
                return;
            }

            var i;
            if (err) {
                for (i = 0; i < callbacks.length; ++i) {
                    (callbacks[i])(err);
                }
                return;
            }

            // (re)create typed array from the returned array buffers
            if (data.format === BASIS_FORMAT.cTFRGB565 || data.format === BASIS_FORMAT.cTFRGBA4444) {
                // handle 16 bit formats
                data.levels = data.levels.map(function (v) {
                    return new Uint16Array(v);
                });
            } else {
                // all other
                data.levels = data.levels.map(function (v) {
                    return new Uint8Array(v);
                });
            }

            // convert basis to pixel format
            data.format = this._basisToPixelFormat(data.format);
            for (i = 0; i < callbacks.length; ++i) {
                (callbacks[i])(null, data);
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
        Basis: Basis,
        BasisParser: BasisParser
    };
}());
