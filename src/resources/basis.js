import { PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R4_G4_B4_A4 } from '../graphics/constants.js';

import { http } from '../net/http.js';

import { getApplication } from '../framework/globals.js';

// Basis worker function. The function assumes pc.PIXELFORMAT_ enums are available.
function BasisWorker() {

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
        cTFRGBA32: 13,                      // rgba 8888
        cTFRGB565: 14,                      // rgb 565
        cTFRGBA4444: 16                     // rgba 4444
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
    // Note that we don't specify the enum constants directly because they're not
    // available in the worker. And if they are specified in the worker code string,
    // they unfortunately get mangled by Terser on minification. So let's write in
    // the actual values directly.
    basisToEngineMapping[BASIS_FORMAT.cTFETC1]          = 21; // PIXELFORMAT_ETC1
    basisToEngineMapping[BASIS_FORMAT.cTFETC2]          = 23; // PIXELFORMAT_ETC2_RGBA
    basisToEngineMapping[BASIS_FORMAT.cTFBC1]           = 8;  // PIXELFORMAT_DXT1
    basisToEngineMapping[BASIS_FORMAT.cTFBC3]           = 10; // PIXELFORMAT_DXT5
    basisToEngineMapping[BASIS_FORMAT.cTFPVRTC1_4_RGB]  = 26; // PIXELFORMAT_PVRTC_4BPP_RGB_1
    basisToEngineMapping[BASIS_FORMAT.cTFPVRTC1_4_RGBA] = 27; // PIXELFORMAT_PVRTC_4BPP_RGBA_1
    basisToEngineMapping[BASIS_FORMAT.cTFASTC_4x4]      = 28; // PIXELFORMAT_ASTC_4x4
    basisToEngineMapping[BASIS_FORMAT.cTFATC_RGB]       = 29; // PIXELFORMAT_ATC_RGB
    basisToEngineMapping[BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA] = 30; // PIXELFORMAT_ATC_RGBA
    basisToEngineMapping[BASIS_FORMAT.cTFRGBA32]        = 7;  // PIXELFORMAT_R8_G8_B8_A8
    basisToEngineMapping[BASIS_FORMAT.cTFRGB565]        = 3;  // PIXELFORMAT_R5_G6_B5
    basisToEngineMapping[BASIS_FORMAT.cTFRGBA4444]      = 5;  // PIXELFORMAT_R4_G4_B4_A4

    var hasPerformance = typeof performance !== 'undefined';

    // unswizzle two-component gggr8888 normal data into rgba8888
    var unswizzleGGGR = function (data) {
        // given R and G generate B
        var genB = function (R, G) {
            var r = R * (2.0 / 255.0) - 1.0;
            var g = G * (2.0 / 255.0) - 1.0;
            var b = Math.sqrt(1.0 - Math.min(1.0, r * r + g * g));
            return Math.max(0, Math.min(255, Math.floor(((b + 1.0) * 0.5) * 255.0)));
        };

        for (var offset = 0; offset < data.length; offset += 4) {
            var R = data[offset + 3];
            var G = data[offset + 1];
            data[offset + 0] = R;
            data[offset + 2] = genB(R, G);
            data[offset + 3] = 255;
        }

        return data;
    };

    // pack rgba8888 data into rgb565
    var pack565 = function (data) {
        var result = new Uint16Array(data.length / 4);

        for (var offset = 0; offset < data.length; offset += 4) {
            var R = data[offset + 0];
            var G = data[offset + 1];
            var B = data[offset + 2];
            result[offset / 4] = ((R & 0xf8) << 8) |  // 5
                                 ((G & 0xfc) << 3) |  // 6
                                 ((B >> 3));          // 5
        }

        return result;
    };

    // transcode the basis super-compressed data into one of the runtime gpu native formats
    var transcode = function (basis, url, format, data, options) {
        var funcStart = hasPerformance ? performance.now() : 0;
        var basisFile = new basis.BasisFile(new Uint8Array(data));

        var width = basisFile.getImageWidth(0, 0);
        var height = basisFile.getImageHeight(0, 0);
        var images = basisFile.getNumImages();
        var levels = basisFile.getNumLevels(0);
        var hasAlpha = !!basisFile.getHasAlpha();

        if (!width || !height || !images || !levels) {
            basisFile.close();
            basisFile.delete();
            throw new Error('Invalid image dimensions url=' + url + ' width=' + width + ' height=' + height + ' images=' + images + ' levels=' + levels);
        }

        // select format based on supported formats
        var basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];

        // PVR does not support non-square or non-pot textures. In these cases we
        // transcode to an uncompressed format.
        if ((basisFormat === BASIS_FORMAT.cTFPVRTC1_4_RGB ||
             basisFormat === BASIS_FORMAT.cTFPVRTC1_4_RGBA)) {
            // if not power-of-two or not square
            if (((width & (width - 1)) !== 0) || (width !== height)) {
                basisFormat = (basisFormat === BASIS_FORMAT.cTFPVRTC1_4_RGB) ?
                    BASIS_FORMAT.cTFRGB565 : BASIS_FORMAT.cTFRGBA32;
            }
        }

        if (options && options.unswizzleGGGR) {
            // in order unswizzle we need gggr8888
            basisFormat = BASIS_FORMAT.cTFRGBA32;
        }

        if (!basisFile.startTranscoding()) {
            basisFile.close();
            basisFile.delete();
            throw new Error('Failed to start transcoding url=' + url);
        }

        var i;

        var levelData = [];
        for (var mip = 0; mip < levels; ++mip) {
            var dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, basisFormat);
            var dst = new Uint8Array(dstSize);

            if (!basisFile.transcodeImage(dst, 0, mip, basisFormat, 1, 0)) {
                basisFile.close();
                basisFile.delete();
                throw new Error('Failed to transcode image url=' + url);
            }

            if (basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444) {
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

        // handle unswizzle option
        if (options && options.unswizzleGGGR) {
            basisFormat = BASIS_FORMAT.cTFRGB565;
            for (i = 0; i < levelData.length; ++i) {
                levelData[i] = pack565(unswizzleGGGR(levelData[i]));
            }
        }

        return {
            format: basisToEngineMapping[basisFormat],
            width: (width + 3) & ~3,
            height: (height + 3) & ~3,
            levels: levelData,
            cubemap: false,
            mipmaps: true,
            transcodeTime: hasPerformance ? (performance.now() - funcStart) : 0,
            url: url
        };
    };

    var basis = null;
    var queue = [];

    // download and transcode the file given the basis module and
    // file url
    var workerTranscode = function (url, format, data, options) {
        try {
            // texture data has been provided
            var result = transcode(basis, url, format, data, options);
            result.levels = result.levels.map(function (v) {
                return v.buffer;
            });
            self.postMessage( { url: url, data: result }, result.levels);
        } catch (err) {
            self.postMessage( { url: url.toString(), err: err.toString() } );
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
                workerTranscode(queue[i].url, queue[i].format, queue[i].data, queue[i].options);
            }
            queue = [];
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
                if (basis) {
                    workerTranscode(data.url, data.format, data.data, data.options);
                } else {
                    queue.push(data);
                }
                break;
        }
    };
}

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

// select the most desirable gpu texture compression format given the device's capabilities
function chooseTargetFormat(device) {
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
}

// global state
var downloadInitiated = false;
var worker = null;
var callbacks = { };
var format = null;
var transcodeQueue = [];
var downloadConfig = null;

function basisTargetFormat() {
    if (!format) {
        format = chooseTargetFormat(getApplication().graphicsDevice);
    }
    return format;
}

function handleWorkerResponse(message) {
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
    if (data.format === PIXELFORMAT_R5_G6_B5 || data.format === PIXELFORMAT_R4_G4_B4_A4) {
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

    delete callbacks[url];
}

// post a transcode job to the web worker
function transcode(url, data, callback, options) {
    if (!callbacks.hasOwnProperty(url)) {
        // store url and kick off worker job
        callbacks[url] = [callback];
        worker.postMessage({ type: 'transcode', url: url, format: basisTargetFormat(), data: data, options: options }, [data]);
    } else {
        // the basis worker is already busy processing this url, store callback
        // (this shouldn't really happen since the asset system only requests
        // a resource once)
        callbacks[url].push(callback);
    }
}

// initialize the basis worker given the basis module script (glue or fallback)
// and the optional accompanying wasm binary.
function basisInitialize(basisCode, basisModule, callback) {
    var code = [
        "/* basis.js */",
        basisCode,
        "",
        "/* worker */",
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
    // module is initialized, initiate queued jobs
    for (var i = 0; i < transcodeQueue.length; ++i) {
        var entry = transcodeQueue[i];
        transcode(entry.url, entry.data, entry.callback, entry.options);
    }
}

// download the module files and initialize the basis worker
function basisDownload(glueUrl, wasmUrl, fallbackUrl, callback) {
    if (downloadInitiated) {
        console.warn('basis module is being downloaded more than once');
    }
    downloadInitiated = true;
    if (wasmSupported) {
        var glueCode = null;
        var compiledModule = null;

        var downloadCompleted = function () {
            if (glueCode && compiledModule) {
                basisInitialize(glueCode, compiledModule, callback);
            }
        };

        // perform the fallback http download if compileStreaming isn't
        // available or fails
        var performHttpDownload = function () {
            http.get(
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
        };

        // download and compile wasm module
        if (WebAssembly.compileStreaming) {
            WebAssembly.compileStreaming(fetch(wasmUrl))
                .then(function (result) {
                    compiledModule = result;
                    downloadCompleted();
                })
                .catch(function (reason) {
                    console.error(reason);
                    console.warn('compileStreaming() failed for ' + wasmUrl + ', falling back to arraybuffer download...');
                    // failed to stream download, attempt arraybuffer download
                    performHttpDownload();
                });
        } else {
            performHttpDownload();
        }

        // download glue script
        http.get(
            glueUrl,
            { cache: true, responseType: "text", retry: false },
            function (err, result) {
                glueCode = result;
                downloadCompleted();
            });
    } else {
        // download fallback script
        http.get(
            fallbackUrl,
            { cache: true, responseType: "text", retry: false },
            function (err, result) {
                if (result) {
                    basisInitialize(result, null, callback);
                }
            });
    }
}

// set the wasm url config to be used if basisDownloadFromConfig is invoked
function basisSetDownloadConfig(glueUrl, wasmUrl, fallbackUrl) {
    downloadConfig = {
        glueUrl: glueUrl,
        wasmUrl: wasmUrl,
        fallbackUrl: fallbackUrl
    };
}

// search for wasm module in the global config and initialize basis
// returns true if it can find the module
function basisDownloadFromConfig(callback) {
    if (downloadConfig) {
        // config was user-specified
        basisDownload(downloadConfig.glueUrl,
                      downloadConfig.wasmUrl,
                      downloadConfig.fallbackUrl,
                      callback);
    } else {
        // get config from global PC config structure
        var modules = (window.config ? window.config.wasmModules : window.PRELOAD_MODULES) || [];
        var wasmModule = modules.find(function (m) {
            return m.moduleName === 'BASIS';
        });
        if (wasmModule) {
            var urlBase = window.ASSET_PREFIX ? window.ASSET_PREFIX : "";
            basisDownload(urlBase + wasmModule.glueUrl,
                          urlBase + wasmModule.wasmUrl,
                          urlBase + wasmModule.fallbackUrl,
                          callback);
        } else {
            // #ifdef DEBUG
            console.warn("WARNING: unable to load basis wasm module - no config was specified");
            // #endif
            return false;
        }
    }
    return true;
}

// render thread worker manager
// options supports the following members:
//   unswizzleGGGR - convert the two-component GGGR normal data to RGB
//                   and pack into 565 format. this is used to overcome
//                   quality issues on apple devices.
// returns true if a transcode module is found
function basisTranscode(url, data, callback, options) {
    if (!worker) {
        // store transcode job if no worker exists
        transcodeQueue.push({ url: url, data: data, callback: callback, options: options });
        // if the basis module download has not yet been initiated, do so now
        if (!downloadInitiated) {
            return basisDownloadFromConfig();
        }
    } else {
        transcode(url, data, callback, options);
    }

    return true;
}

export {
    basisDownload,
    basisSetDownloadConfig,
    basisDownloadFromConfig,
    basisInitialize,
    basisTargetFormat,
    basisTranscode
};
