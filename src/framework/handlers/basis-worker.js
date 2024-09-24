// Basis worker
function BasisWorker() {
    // basis compression format enums, reproduced here
    const BASIS_FORMAT = {
        cTFETC1: 0,                         // etc1
        cTFETC2: 1,                         // etc2
        cTFBC1: 2,                          // dxt1
        cTFBC3: 3,                          // dxt5
        cTFASTC_4x4: 10,                    // ASTC
        // uncompressed (fallback) formats
        cTFRGBA32: 13,                      // rgba 8888
        cTFRGB565: 14,                      // rgb 565
        cTFRGBA4444: 16                     // rgba 4444
    };

    // map of GPU to basis format for textures without alpha
    const opaqueMapping = {
        astc: BASIS_FORMAT.cTFASTC_4x4,
        dxt: BASIS_FORMAT.cTFBC1,
        etc1: BASIS_FORMAT.cTFETC1,
        etc2: BASIS_FORMAT.cTFETC1,
        none: BASIS_FORMAT.cTFRGB565
    };

    // map of GPU to basis format for textures with alpha
    const alphaMapping = {
        astc: BASIS_FORMAT.cTFASTC_4x4,
        dxt: BASIS_FORMAT.cTFBC3,
        etc1: BASIS_FORMAT.cTFRGBA4444,
        etc2: BASIS_FORMAT.cTFETC2,
        none: BASIS_FORMAT.cTFRGBA4444
    };

    // engine pixel format constants, reproduced here
    const PIXEL_FORMAT = {
        ETC1: 21,
        ETC2_RGB: 22,
        ETC2_RGBA: 23,
        DXT1: 8,
        DXT5: 10,
        PVRTC_4BPP_RGB_1: 26,
        PVRTC_4BPP_RGBA_1: 27,
        ASTC_4x4: 28,
        ATC_RGB: 29,
        ATC_RGBA: 30,
        R8_G8_B8_A8: 7,
        R5_G6_B5: 3,
        R4_G4_B4_A4: 5
    };

    // map of basis format to engine pixel format
    const basisToEngineMapping = (basisFormat, deviceDetails) => {
        switch (basisFormat) {
            case BASIS_FORMAT.cTFETC1: return deviceDetails.formats.etc1 ? PIXEL_FORMAT.ETC1 : PIXEL_FORMAT.ETC2_RGB;
            case BASIS_FORMAT.cTFETC2: return PIXEL_FORMAT.ETC2_RGBA;
            case BASIS_FORMAT.cTFBC1: return PIXEL_FORMAT.DXT1;
            case BASIS_FORMAT.cTFBC3: return PIXEL_FORMAT.DXT5;
            case BASIS_FORMAT.cTFPVRTC1_4_RGB: return PIXEL_FORMAT.PVRTC_4BPP_RGB_1;
            case BASIS_FORMAT.cTFPVRTC1_4_RGBA: return PIXEL_FORMAT.PVRTC_4BPP_RGBA_1;
            case BASIS_FORMAT.cTFASTC_4x4: return PIXEL_FORMAT.ASTC_4x4;
            case BASIS_FORMAT.cTFATC_RGB: return PIXEL_FORMAT.ATC_RGB;
            case BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA: return PIXEL_FORMAT.ATC_RGBA;
            case BASIS_FORMAT.cTFRGBA32: return PIXEL_FORMAT.R8_G8_B8_A8;
            case BASIS_FORMAT.cTFRGB565: return PIXEL_FORMAT.R5_G6_B5;
            case BASIS_FORMAT.cTFRGBA4444: return PIXEL_FORMAT.R4_G4_B4_A4;
        }
    };

    const isPOT = (width, height) => {
        return ((width & (width - 1)) === 0) && ((height & (height - 1)) === 0);
    };

    const performanceNow = () => {
        return (typeof performance !== 'undefined') ? performance.now() : 0;
    };

    // globals, set on worker init
    let basis;
    let rgbPriority;
    let rgbaPriority;

    const chooseTargetFormat = (deviceDetails, hasAlpha, isUASTC) => {
        // attempt to match file compression scheme with runtime compression
        if (isUASTC) {
            if (deviceDetails.formats.astc) {
                return 'astc';
            }
        } else {
            if (hasAlpha) {
                if (deviceDetails.formats.etc2) {
                    return 'etc2';
                }
            } else {
                if (deviceDetails.formats.etc1 || deviceDetails.formats.etc2) {
                    return 'etc1';
                }
            }
        }

        const testInOrder = (priority) => {
            for (let i = 0; i < priority.length; ++i) {
                const format = priority[i];
                if (deviceDetails.formats[format]) {
                    return format;
                }
            }
            return 'none';
        };

        return testInOrder(hasAlpha ? rgbaPriority : rgbPriority);
    };

    // return true if the texture dimensions are valid for the target format
    const dimensionsValid = (width, height, format) => {
        switch (format) {
            // dxt1, 5
            case BASIS_FORMAT.cTFBC1:
            case BASIS_FORMAT.cTFBC3:
                // width and height must be multiple of 4
                return ((width & 0x3) === 0) && ((height & 0x3) === 0);
        }
        return true;
    };

    const transcodeKTX2 = (url, data, options) => {
        if (!basis.KTX2File) {
            throw new Error('Basis transcoder module does not include support for KTX2.');
        }

        const funcStart = performanceNow();
        const basisFile = new basis.KTX2File(new Uint8Array(data));

        const width = basisFile.getWidth();
        const height = basisFile.getHeight();
        const levels = basisFile.getLevels();
        const hasAlpha = !!basisFile.getHasAlpha();
        const isUASTC = basisFile.isUASTC && basisFile.isUASTC();

        if (!width || !height || !levels) {
            basisFile.close();
            basisFile.delete();
            throw new Error(`Invalid image dimensions url=${url} width=${width} height=${height} levels=${levels}`);
        }

        // choose the target format
        const format = chooseTargetFormat(options.deviceDetails, hasAlpha, isUASTC);

        // convert to basis format taking into consideration platform restrictions
        let basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];

        // if image dimensions don't work on target, fall back to uncompressed
        if (!dimensionsValid(width, height, basisFormat)) {
            basisFormat = hasAlpha ? BASIS_FORMAT.cTFRGBA32 : BASIS_FORMAT.cTFRGB565;
        }

        if (!basisFile.startTranscoding()) {
            basisFile.close();
            basisFile.delete();
            throw new Error(`Failed to start transcoding url=${url}`);
        }

        const levelData = [];
        for (let mip = 0; mip < levels; ++mip) {
            if (!options.deviceDetails.webgl2 && mip > 0 && !isPOT(width, height)) {
                break;
            }
            const dstSize = basisFile.getImageTranscodedSizeInBytes(mip, 0, 0, basisFormat);
            const dst = new Uint8Array(dstSize);

            if (!basisFile.transcodeImage(dst, mip, 0, 0, basisFormat, 0, -1, -1)) {
                basisFile.close();
                basisFile.delete();
                throw new Error(`Failed to transcode image url=${url}`);
            }

            const is16BitFormat = (basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444);

            levelData.push(is16BitFormat ? new Uint16Array(dst.buffer) : dst);
        }

        basisFile.close();
        basisFile.delete();

        return {
            format: basisToEngineMapping(basisFormat, options.deviceDetails),
            width: width,
            height: height,
            levels: levelData,
            cubemap: false,
            transcodeTime: performanceNow() - funcStart,
            url: url
        };
    };

    // transcode the basis super-compressed data into one of the runtime gpu native formats
    const transcodeBasis = (url, data, options) => {
        const funcStart = performanceNow();
        const basisFile = new basis.BasisFile(new Uint8Array(data));

        const width = basisFile.getImageWidth(0, 0);
        const height = basisFile.getImageHeight(0, 0);
        const images = basisFile.getNumImages();
        const levels = basisFile.getNumLevels(0);
        const hasAlpha = !!basisFile.getHasAlpha();
        const isUASTC = basisFile.isUASTC && basisFile.isUASTC();

        if (!width || !height || !images || !levels) {
            basisFile.close();
            basisFile.delete();
            throw new Error(`Invalid image dimensions url=${url} width=${width} height=${height} images=${images} levels=${levels}`);
        }

        // choose the target format
        const format = chooseTargetFormat(options.deviceDetails, hasAlpha, isUASTC);

        // convert to basis format taking into consideration platform restrictions
        let basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];

        // if image dimensions don't work on target, fall back to uncompressed
        if (!dimensionsValid(width, height, basisFormat)) {
            basisFormat = hasAlpha ? BASIS_FORMAT.cTFRGBA32 : BASIS_FORMAT.cTFRGB565;
        }

        if (!basisFile.startTranscoding()) {
            basisFile.close();
            basisFile.delete();
            throw new Error(`Failed to start transcoding url=${url}`);
        }

        let i;

        const levelData = [];
        for (let mip = 0; mip < levels; ++mip) {
            if (!options.deviceDetails.webgl2 && mip > 0 && !isPOT(width, height)) {
                break;
            }
            const dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, basisFormat);
            const dst = new Uint8Array(dstSize);

            if (!basisFile.transcodeImage(dst, 0, mip, basisFormat, 0, 0)) {
                if (mip === levels - 1 && dstSize === levelData[mip - 1].buffer.byteLength) {
                    // https://github.com/BinomialLLC/basis_universal/issues/358
                    // there is a regression on iOS/safari 17 where the last mipmap level
                    // fails to transcode. this is a workaround which copies the previous mip
                    // level data instead of failing.
                    dst.set(new Uint8Array(levelData[mip - 1].buffer));
                    console.warn(`Failed to transcode last mipmap level, using previous level instead url=${url}`);
                } else {
                    basisFile.close();
                    basisFile.delete();
                    throw new Error(`Failed to transcode image url=${url}`);
                }
            }

            const is16BitFormat = (basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444);

            levelData.push(is16BitFormat ? new Uint16Array(dst.buffer) : dst);
        }

        basisFile.close();
        basisFile.delete();

        return {
            format: basisToEngineMapping(basisFormat, options.deviceDetails),
            width: width,
            height: height,
            levels: levelData,
            cubemap: false,
            transcodeTime: performanceNow() - funcStart,
            url: url
        };
    };

    const transcode = (url, data, options) => {
        return options.isKTX2 ? transcodeKTX2(url, data, options) : transcodeBasis(url, data, options);
    };

    // download and transcode the file given the basis module and
    // file url
    const workerTranscode = (url, data, options) => {
        try {
            const result = transcode(url, data, options);
            result.levels = result.levels.map(v => v.buffer);
            self.postMessage({ url: url, data: result }, result.levels);
        } catch (err) {
            self.postMessage({ url: url, err: err }, null);
        }
    };

    const workerInit = (config, callback) => {
        // initialize the wasm module
        const instantiateWasmFunc = (imports, successCallback) => {
            WebAssembly.instantiate(config.module, imports)
            .then((result) => {
                successCallback(result);
            })
            .catch((reason) => {
                console.error(`instantiate failed + ${reason}`);
            });
            return {};
        };
        self.BASIS(config.module ? { instantiateWasm: instantiateWasmFunc } : undefined)
        .then((instance) => {
            instance.initializeBasis();

            // set globals
            basis = instance;
            rgbPriority = config.rgbPriority;
            rgbaPriority = config.rgbaPriority;

            callback(null);
        });
    };

    // handle incoming worker requests
    const queue = [];
    self.onmessage = (message) => {
        const data = message.data;
        switch (data.type) {
            case 'init':
                workerInit(data.config, () => {
                    for (let i = 0; i < queue.length; ++i) {
                        workerTranscode(queue[i].url, queue[i].data, queue[i].options);
                    }
                    queue.length = 0;
                });
                break;
            case 'transcode':
                if (basis) {
                    workerTranscode(data.url, data.data, data.options);
                } else {
                    queue.push(data);
                }
                break;
        }
    };
}

export {
    BasisWorker
};
