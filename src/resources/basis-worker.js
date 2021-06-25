// Basis worker
function BasisWorker() {

    // Basis compression format enums
    // Note: these must match definitions in the BASIS module
    const BASIS_FORMAT = {
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
    const opaqueMapping = {
        astc: BASIS_FORMAT.cTFASTC_4x4,
        dxt: BASIS_FORMAT.cTFBC1,
        etc2: BASIS_FORMAT.cTFETC1,
        etc1: BASIS_FORMAT.cTFETC1,
        pvr: BASIS_FORMAT.cTFPVRTC1_4_RGB,
        atc: BASIS_FORMAT.cTFATC_RGB,
        none: BASIS_FORMAT.cTFRGB565
    };

    // Map GPU to basis format for textures with alpha
    const alphaMapping = {
        astc: BASIS_FORMAT.cTFASTC_4x4,
        dxt: BASIS_FORMAT.cTFBC3,
        etc2: BASIS_FORMAT.cTFETC2,
        etc1: BASIS_FORMAT.cTFRGBA4444,
        pvr: BASIS_FORMAT.cTFPVRTC1_4_RGBA,
        atc: BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA,
        none: BASIS_FORMAT.cTFRGBA4444
    };

    // Map basis format to engine pixel format
    const basisToEngineMapping = { };
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

    const hasPerformance = typeof performance !== 'undefined';

    // unswizzle two-component gggr8888 normal data into rgba8888
    const unswizzleGGGR = (data) => {
        // given R and G generate B
        const genB = function (R, G) {
            const r = R * (2.0 / 255.0) - 1.0;
            const g = G * (2.0 / 255.0) - 1.0;
            const b = Math.sqrt(1.0 - Math.min(1.0, r * r + g * g));
            return Math.max(0, Math.min(255, Math.floor(((b + 1.0) * 0.5) * 255.0)));
        };

        for (let offset = 0; offset < data.length; offset += 4) {
            const R = data[offset + 3];
            const G = data[offset + 1];
            data[offset + 0] = R;
            data[offset + 2] = genB(R, G);
            data[offset + 3] = 255;
        }

        return data;
    };

    // pack rgba8888 data into rgb565
    const pack565 = (data) => {
        const result = new Uint16Array(data.length / 4);

        for (let offset = 0; offset < data.length; offset += 4) {
            const R = data[offset + 0];
            const G = data[offset + 1];
            const B = data[offset + 2];
            result[offset / 4] = ((R & 0xf8) << 8) |  // 5
                                 ((G & 0xfc) << 3) |  // 6
                                 ((B >> 3));          // 5
        }

        return result;
    };

    // transcode the basis super-compressed data into one of the runtime gpu native formats
    const transcode = (basis, url, format, data, options) => {
        const funcStart = hasPerformance ? performance.now() : 0;
        const basisFile = new basis.BasisFile(new Uint8Array(data));

        const width = basisFile.getImageWidth(0, 0);
        const height = basisFile.getImageHeight(0, 0);
        const images = basisFile.getNumImages();
        const levels = basisFile.getNumLevels(0);
        const hasAlpha = !!basisFile.getHasAlpha();

        if (!width || !height || !images || !levels) {
            basisFile.close();
            basisFile.delete();
            throw new Error('Invalid image dimensions url=' + url + ' width=' + width + ' height=' + height + ' images=' + images + ' levels=' + levels);
        }

        // select format based on supported formats
        let basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];

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

        let i;

        const levelData = [];
        for (let mip = 0; mip < levels; ++mip) {
            const dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, basisFormat);
            let dst = new Uint8Array(dstSize);

            if (!basisFile.transcodeImage(dst, 0, mip, basisFormat, 1, 0)) {
                basisFile.close();
                basisFile.delete();
                throw new Error('Failed to transcode image url=' + url);
            }

            if (basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444) {
                // 16 bit formats require Uint16 typed array
                const dst16 = new Uint16Array(dstSize / 2);
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

    let basis = null;
    const queue = [];

    // download and transcode the file given the basis module and
    // file url
    const workerTranscode = (url, format, data, options) => {
        try {
            // texture data has been provided
            const result = transcode(basis, url, format, data, options);
            result.levels = result.levels.map(function (v) {
                return v.buffer;
            });
            self.postMessage({ url: url, data: result }, result.levels);
        } catch (err) {
            self.postMessage({ url: url.toString(), err: err.toString() });
        }
    };

    const workerInit = (config) => {
        console.log('starting basis worker');

        // load the basis file (this is synchronous)
        self.importScripts(config.basisUrl);

        // initialize the wasm module
        const instantiateWasmFunc = (imports, successCallback) => {
            WebAssembly.instantiate(config.module, imports)
                .then((result) => {
                    successCallback(result);
                })
                .catch((reason) => {
                    console.error('instantiate failed + ' + reason);
                });
            return {};
        };

        self.BASIS(config.module ? { instantiateWasm: instantiateWasmFunc } : null)
            .then((instance) => {
                basis = instance;
                basis.initializeBasis();
                for (let i = 0; i < queue.length; ++i) {
                    workerTranscode(queue[i].url, queue[i].format, queue[i].data, queue[i].options);
                }
                queue.length = 0;
            })
            .catch((reason) => {
                console.error('instantiate failed ' + reason);
            });
    };

    // handle incoming worker requests
    self.onmessage = function (message) {
        const data = message.data;
        switch (data.type) {
            case 'init':
                workerInit(data.config);
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

export {
    BasisWorker
};
