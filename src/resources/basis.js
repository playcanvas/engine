Object.assign(pc, function () {

    // Basis compression format enums
    // Note: these must match definitions in the BASIS module
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
        cTFRGB565: 14,                      // rgb 565
        cTFRGBA4444: 16                     // rgbq 4444
    };

    // Map GPU to basis format for textures without alpha
    var opaqueMapping = {
        astc: BASIS_FORMAT.cTFASTC_4x4,
        dxt: BASIS_FORMAT.cTFBC1,
        etc2: BASIS_FORMAT.cTFETC1,
        etc1: BASIS_FORMAT.cTFETC1,
        pvr: BASIS_FORMAT.cTFPVRTC1_4_RGB,
        atc: BASIS_FORMAT.cTFATC_RGB,
        none: BASIS_FORMAT.cTFRGB565
    };

    // Map GPU to basis format for textures with alpha
    var alphaMapping = {
        astc: BASIS_FORMAT.cTFASTC_4x4,
        dxt: BASIS_FORMAT.cTFBC3,
        etc2: BASIS_FORMAT.cTFETC2,
        etc1: BASIS_FORMAT.cTFRGBA4444,
        pvr: BASIS_FORMAT.cTFPVRTC1_4_RGBA,
        atc: BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA,
        none: BASIS_FORMAT.cTFRGBA4444
    };

    // Map basis format to engine pixel format
    var basisToEngineMapping = { };
    basisToEngineMapping[BASIS_FORMAT.cTFETC1]          = pc.PIXELFORMAT_ETC1;
    basisToEngineMapping[BASIS_FORMAT.cTFETC2]          = pc.PIXELFORMAT_ETC2_RGBA;
    basisToEngineMapping[BASIS_FORMAT.cTFBC1]           = pc.PIXELFORMAT_DXT1;
    basisToEngineMapping[BASIS_FORMAT.cTFBC3]           = pc.PIXELFORMAT_DXT5;
    basisToEngineMapping[BASIS_FORMAT.cTFPVRTC1_4_RGB]  = pc.PIXELFORMAT_PVRTC_4BPP_RGB_1;
    basisToEngineMapping[BASIS_FORMAT.cTFPVRTC1_4_RGBA] = pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1;
    basisToEngineMapping[BASIS_FORMAT.cTFASTC_4x4]      = pc.PIXELFORMAT_ASTC_4x4;
    basisToEngineMapping[BASIS_FORMAT.cTFATC_RGB]       = pc.PIXELFORMAT_ATC_RGB;
    basisToEngineMapping[BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA] = pc.PIXELFORMAT_ATC_RGBA;
    basisToEngineMapping[BASIS_FORMAT.cTFRGB565]        = pc.PIXELFORMAT_R5_G6_B5;
    basisToEngineMapping[BASIS_FORMAT.cTFRGBA4444]      = pc.PIXELFORMAT_R4_G4_B4_A4;

    // Basis worker function. The function assumes BASIS module is loaded as well as the format
    // mappings above.
    var BasisWorker = function () {

        // transcode the basis super-compressed data into one of the runtime gpu native formats
        var transcode = function (basis, url, format, data) {
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
                throw new Error('Invalid image dimensions url=' + url);
            }

            // select format based on supported formats
            var basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];

            if (!basisFile.startTranscoding()) {
                basisFile.close();
                basisFile.delete();
                throw new Error('Failed to start transcoding url=' + url);
            }

            var levelData = [];
            for (var mip = 0; mip < levels; ++mip) {
                var dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, basisFormat);
                var dst = new Uint8Array(dstSize);

                if (!basisFile.transcodeImage(dst, 0, mip, basisFormat, 1, 0)) {
                    basisFile.close();
                    basisFile.delete();
                    throw new Error('Failed to transcode image url=' + url);
                }

                var i;
                if (basisFormat === 14 /* BASIS_FORMAT.cTFRGB565 */ || basisFormat === 16 /* BASIS_FORMAT.cTFRGBA4444 */) {
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
                format: basisToEngineMapping[basisFormat],
                width: (width + 3) & ~3,
                height: (height + 3) & ~3,
                levels: levelData,
                cubemap: false,
                mipmaps: true,
                transcodeTime: performance.now() - funcStart,
                url: url
            };
        };

        var basis = null;
        var queue = [];

        // download and transcode the file given the basis module and
        // file url
        var workerTranscode = function (url, format, data) {
            if (basis) {
                try {
                    // texture data has been provided
                    var result = transcode(basis, url, format, data);
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

        // Initialize the web worker's BASIS interface.
        // basisModule is the optional wasm binary.
        var workerInit = function (basisModule) {
            var instantiateWasmFunc = function (imports, successCallback) {
                WebAssembly.instantiate(basisModule, imports)
                    .then( function (result) {
                        successCallback(result);
                    });
                return {};
            };

            self.BASIS(basisModule ? { instantiateWasm: instantiateWasmFunc } : null).then( function (instance) {
                basis = instance;
                basis.initializeBasis();
                for (var i = 0; i < queue.length; ++i) {
                    workerTranscode(queue[i][0], queue[i][1]);
                }
                queue = null;
            } );
        };

        // handle incoming worker requests
        self.onmessage = function (message) {
            var data = message.data;
            switch (data.type) {
                case 'init':
                    workerInit(data.module);
                    break;
                case 'transcode':
                    workerTranscode(data.url, data.format, data.data);
                    break;
            }
        };
    };

    var worker = null;
    var callbacks = { };
    var format = null;

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

    var handleWorkerResponse = function (message) {
        var url = message.data.url;
        var err = message.data.err;
        var data = message.data.data;
        var callback = callbacks[url];

        if (!callback) {
            console.error('internal logical error encountered in basis transcoder');
            return;
        }

        var i;
        if (err) {
            for (i = 0; i < callback.length; ++i) {
                (callback[i])(err);
            }
            return;
        }

        // (re)create typed array from the returned array buffers
        if (data.format === pc.PIXELFORMAT_R5_G6_B5 || data.format === pc.PIXELFORMAT_R4_G4_B4_A4) {
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

        for (i = 0; i < callback.length; ++i) {
            (callback[i])(null, data);
        }
    };

    // initialize the basis module given the module glue (or fallback) script and the optional
    // accompanying wasm module.
    var basisInitialize = function (basisCode, basisModule, callback) {
        var code = [
            "/* basis.js */",
            basisCode,
            "/* mappings */",
            "var opaqueMapping=" + JSON.stringify(opaqueMapping) + ";",
            "var alphaMapping=" + JSON.stringify(alphaMapping) + ";",
            "var basisToEngineMapping=" + JSON.stringify(basisToEngineMapping) + ";",
            " /* worker */",
            '(' + BasisWorker.toString() + ')()\n\n'
        ].join('\n');
        var blob = new Blob([code], { type: 'application/javascript' });
        var url = URL.createObjectURL(blob);
        worker = new Worker(url);
        worker.addEventListener('message', handleWorkerResponse);
        worker.postMessage({ type: 'init', module: basisModule });
        if (callback) {
            callback();
        }
    };

    // helper function which downloads and then initializes the basis module
    var basisDownload = function (glueUrl, wasmUrl, fallbackUrl, callback) {
        if (wasmSupported) {
            var glueCode = null;
            var compiledModule = null;

            var downloadCompleted = function () {
                if (glueCode && compiledModule) {
                    basisInitialize(glueCode, compiledModule, callback);
                }
            };

            // download and compile wasm module
            WebAssembly.compileStreaming(fetch(wasmUrl))
                .then(function (result) {
                    compiledModule = result;
                    downloadCompleted();
                })
                .catch(function (reason) {
                    console.error(reason);
                    console.warn('compileStreaming() failed for ' + wasmUrl + ', falling back to arraybuffer download...');
                    // failed to stream download, attempt arraybuffer download
                    pc.http.get(
                        wasmUrl,
                        { cache: true, responseType: "arraybuffer", retry: false },
                        function (err, result) {
                            if (result) {
                                WebAssembly.compile(result)
                                    .then(function (result) {
                                        compiledModule = result;
                                        downloadCompleted();
                                    });
                            }
                        });
                });

            // download glue script
            pc.http.get(
                glueUrl,
                { cache: true, responseType: "text", retry: false },
                function (err, result) {
                    glueCode = result;
                    downloadCompleted();
                });
        } else {
            // download fallback script
            pc.http.get(
                fallbackUrl,
                { cache: true, responseType: "text", retry: false },
                function (err, result) {
                    if (result) {
                        basisInitialize(result, null, callback);
                    }
                });
        }
    };

    // select the most desirable gpu texture compression format given the device's capabilities
    var selectTextureCompressionFormat = function (device) {
        if (device.extCompressedTextureASTC) {
            return 'astc';
        } else if (device.extCompressedTextureS3TC) {
            return 'dxt';
        } else if (device.extCompressedTextureETC) {
            return 'etc2';
        } else if (device.extCompressedTextureETC1) {
            return 'etc1';
        } else if (device.extCompressedTexturePVRTC) {
            return 'pvr';
        } else if (device.extCompressedTextureATC) {
            return 'atc';
        }
        return 'none';
    };

    // render thread worker manager
    var basisTranscode = function (url, data, callback) {
        if (!worker) {
            console.error('call pc.basisInitialize before loading basis textures');
            return;
        }
        if (!callbacks.hasOwnProperty(url)) {
            if (!format) {
                format = selectTextureCompressionFormat(pc.app.graphicsDevice);
            }
            // store url and kick off worker job
            callbacks[url] = [callback];
            worker.postMessage({ type: 'transcode', url: url, format: format, data: data }, [data]);
        } else {
            // the basis worker is already busy processing this url, store callback
            // (this shouldn't really happen since the asset system only requests
            // a resource once)
            callbacks[url].push(callback);
        }
    };

    return {
        basisInitialize: basisInitialize,
        basisDownload: basisDownload,
        basisTranscode: basisTranscode
    };
}());
