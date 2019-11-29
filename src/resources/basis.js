Object.assign(pc, function () {

    var BasisWorker = function () {

        // transcode the basis super-compressed data into one of the runtime gpu native formats
        var transcode = function (basis, url, formats, data) {
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
            var format = formats[hasAlpha ? 0 : 1];

            if (!basisFile.startTranscoding()) {
                basisFile.close();
                basisFile.delete();
                throw new Error('Failed to start transcoding url=' + url);
            }

            var levelData = [];
            for (var mip = 0; mip < levels; ++mip) {
                var dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, format);
                var dst = new Uint8Array(dstSize);

                if (!basisFile.transcodeImage(dst, 0, mip, format, 1, 0)) {
                    basisFile.close();
                    basisFile.delete();
                    throw new Error('Failed to transcode image url=' + url);
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

        var basis = null;
        var queue = [];

        // download and transcode the file given the basis module and
        // file url
        var workerTranscode = function (url, formats, data) {
            if (basis) {
                try {
                    // texture data has been provided
                    var result = transcode(basis, url, formats, data);
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
                    workerTranscode(data.url, data.formats, data.data);
                    break;
            }
        };
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

    var worker = null;
    var callbacks = { };
    var formats = null;

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

    var basisToPixelFormat = function (format) {
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
    };

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
        data.format = basisToPixelFormat(data.format);
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
        return '';
    };

    // given the device's texture compression format, select the basis pixel format to use
    // for alpha and opaque textures.
    // returns [basis semitrans format, basis opaque format]
    var getBasisPixelFormats = function (format) {
        switch (format) {
            case 'astc': return [BASIS_FORMAT.cTFASTC_4x4, BASIS_FORMAT.cTFASTC_4x4];
            case 'dxt': return [BASIS_FORMAT.cTFBC3, BASIS_FORMAT.cTFBC1];
            case 'etc2': return [BASIS_FORMAT.cTFETC2, BASIS_FORMAT.cTFETC1];
            case 'etc1': return [BASIS_FORMAT.cTFRGBA4444, BASIS_FORMAT.cTFETC1];    // TODO: fallback to 4444 or 8888?
            case 'pvr': return [BASIS_FORMAT.cTFPVRTC1_4_RGBA, BASIS_FORMAT.cTFPVRTC1_4_RGB];
            case 'atc': return [BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA, BASIS_FORMAT.cTFATC_RGB];
            default: return [BASIS_FORMAT.cTFRGBA4444, BASIS_FORMAT.cTFRGB565];
        }
    };

    // render thread worker manager
    var basisTranscode = function (url, data, callback) {
        if (!callbacks.hasOwnProperty(url)) {
            if (!formats) {
                formats = getBasisPixelFormats(selectTextureCompressionFormat(pc.app.graphicsDevice));
            }
            // store url and kick off worker job
            callbacks[url] = [callback];
            worker.postMessage({ type: 'transcode', url: url, formats: formats, data: data }, [data]);
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
