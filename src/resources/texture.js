Object.assign(pc, function () {
    'use strict';

    var JSON_ADDRESS_MODE = {
        "repeat": pc.ADDRESS_REPEAT,
        "clamp": pc.ADDRESS_CLAMP_TO_EDGE,
        "mirror": pc.ADDRESS_MIRRORED_REPEAT
    };

    var JSON_FILTER_MODE = {
        "nearest": pc.FILTER_NEAREST,
        "linear": pc.FILTER_LINEAR,
        "nearest_mip_nearest": pc.FILTER_NEAREST_MIPMAP_NEAREST,
        "linear_mip_nearest": pc.FILTER_LINEAR_MIPMAP_NEAREST,
        "nearest_mip_linear": pc.FILTER_NEAREST_MIPMAP_LINEAR,
        "linear_mip_linear": pc.FILTER_LINEAR_MIPMAP_LINEAR
    };

    function arrayBufferCopy(src, dst, dstByteOffset, numBytes) {
        var i;
        var dst32Offset = dstByteOffset / 4;
        var tail = (numBytes % 4);
        var src32 = new Uint32Array(src.buffer, 0, (numBytes - tail) / 4);
        var dst32 = new Uint32Array(dst.buffer);
        for (i = 0; i < src32.length; i++) {
            dst32[dst32Offset + i] = src32[i];
        }
        for (i = numBytes - tail; i < numBytes; i++) {
            dst[dstByteOffset + i] = src[i];
        }
    }

    var _legacyDdsLoader = function (url, data, graphicsDevice) {

        var ext = pc.path.getExtension(url).toLowerCase();

        if (ext === ".crn") {
            // Copy loaded file into Emscripten-managed memory
            var srcSize = data.byteLength;
            var bytes = new Uint8Array(data);
            var src = Module._malloc(srcSize);
            arrayBufferCopy(bytes, Module.HEAPU8, src, srcSize);

            // Decompress CRN to DDS (minus the header)
            var dst = Module._crn_decompress_get_data(src, srcSize);
            var dstSize = Module._crn_decompress_get_size(src, srcSize);

            data = Module.HEAPU8.buffer.slice(dst, dst + dstSize);
        }

        // DDS loading
        var header = new Uint32Array(data, 0, 128 / 4);

        var width = header[4];
        var height = header[3];
        var mips = Math.max(header[7], 1);
        var isFourCc = header[20] === 4;
        var fcc = header[21];
        var bpp = header[22];
        var isCubemap = header[28] === 65024; // TODO: check by bitflag

        var FCC_DXT1 = 827611204; // DXT1
        var FCC_DXT5 = 894720068; // DXT5
        var FCC_FP32 = 116; // RGBA32f

        // non standard
        var FCC_ETC1 = 826496069;
        var FCC_PVRTC_2BPP_RGB_1 = 825438800;
        var FCC_PVRTC_2BPP_RGBA_1 = 825504336;
        var FCC_PVRTC_4BPP_RGB_1 = 825439312;
        var FCC_PVRTC_4BPP_RGBA_1 = 825504848;

        var compressed = false;
        var floating = false;
        var etc1 = false;
        var pvrtc2 = false;
        var pvrtc4 = false;
        var format = null;

        var texture;

        if (isFourCc) {
            if (fcc === FCC_DXT1) {
                format = pc.PIXELFORMAT_DXT1;
                compressed = true;
            } else if (fcc === FCC_DXT5) {
                format = pc.PIXELFORMAT_DXT5;
                compressed = true;
            } else if (fcc === FCC_FP32) {
                format = pc.PIXELFORMAT_RGBA32F;
                floating = true;
            } else if (fcc === FCC_ETC1) {
                format = pc.PIXELFORMAT_ETC1;
                compressed = true;
                etc1 = true;
            } else if (fcc === FCC_PVRTC_2BPP_RGB_1 || fcc === FCC_PVRTC_2BPP_RGBA_1) {
                format = fcc === FCC_PVRTC_2BPP_RGB_1 ? pc.PIXELFORMAT_PVRTC_2BPP_RGB_1 : pc.PIXELFORMAT_PVRTC_2BPP_RGBA_1;
                compressed = true;
                pvrtc2 = true;
            } else if (fcc === FCC_PVRTC_4BPP_RGB_1 || fcc === FCC_PVRTC_4BPP_RGBA_1) {
                format = fcc === FCC_PVRTC_4BPP_RGB_1 ? pc.PIXELFORMAT_PVRTC_4BPP_RGB_1 : pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1;
                compressed = true;
                pvrtc4 = true;
            }
        } else {
            if (bpp === 32) {
                format = pc.PIXELFORMAT_R8_G8_B8_A8;
            }
        }

        if (!format) {
            // #ifdef DEBUG
            console.error("This DDS pixel format is currently unsupported. Empty texture will be created instead.");
            // #endif
            texture = new pc.Texture(graphicsDevice, {
                width: 4,
                height: 4,
                format: pc.PIXELFORMAT_R8_G8_B8
            });
            texture.name = 'dds-legacy-empty';
            return texture;
        }

        var texOptions = {
            // #ifdef PROFILER
            profilerHint: pc.TEXHINT_ASSET,
            // #endif
            width: width,
            height: height,
            format: format,
            cubemap: isCubemap
        };
        texture = new pc.Texture(graphicsDevice, texOptions);
        if (isCubemap) {
            texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        }

        var offset = 128;
        var faces = isCubemap ? 6 : 1;
        var mipSize;
        var DXT_BLOCK_WIDTH = 4;
        var DXT_BLOCK_HEIGHT = 4;
        var blockSize = fcc === FCC_DXT1 ? 8 : 16;
        var numBlocksAcross, numBlocksDown, numBlocks;
        for (var face = 0; face < faces; face++) {
            var mipWidth = width;
            var mipHeight = height;
            for (var i = 0; i < mips; i++) {
                if (compressed) {
                    if (etc1) {
                        mipSize = Math.floor((mipWidth + 3) / 4) * Math.floor((mipHeight + 3) / 4) * 8;
                    } else if (pvrtc2) {
                        mipSize = Math.max(mipWidth, 16) * Math.max(mipHeight, 8) / 4;
                    } else if (pvrtc4) {
                        mipSize = Math.max(mipWidth, 8) * Math.max(mipHeight, 8) / 2;
                    } else {
                        numBlocksAcross = Math.floor((mipWidth + DXT_BLOCK_WIDTH - 1) / DXT_BLOCK_WIDTH);
                        numBlocksDown = Math.floor((mipHeight + DXT_BLOCK_HEIGHT - 1) / DXT_BLOCK_HEIGHT);
                        numBlocks = numBlocksAcross * numBlocksDown;
                        mipSize = numBlocks * blockSize;
                    }
                } else {
                    mipSize = mipWidth * mipHeight * 4;
                }

                var mipBuff = floating ? new Float32Array(data, offset, mipSize) : new Uint8Array(data, offset, mipSize);
                if (!isCubemap) {
                    texture._levels[i] = mipBuff;
                } else {
                    if (!texture._levels[i]) texture._levels[i] = [];
                    texture._levels[i][face] = mipBuff;
                }
                offset += floating ? mipSize * 4 : mipSize;
                mipWidth = Math.max(mipWidth * 0.5, 1);
                mipHeight = Math.max(mipHeight * 0.5, 1);
            }
        }

        texture.name = url;
        texture.upload();

        return texture;
    };

    var TextureHandler = function (device, assets, loader) {
        this._device = device;
        this._assets = assets;
        this._loader = loader;

        // by default don't try cross-origin, because some browsers send different cookies (e.g. safari) if this is set.
        this.crossOrigin = undefined;
        if (assets.prefix) {
            // ensure we send cookies if we load images.
            this.crossOrigin = 'anonymous';
        }

        this.retryRequests = false;
    };

    Object.assign(TextureHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var self = this;

            var urlWithoutParams = url.original.indexOf('?') >= 0 ? url.original.split('?')[0] : url.original;

            var ext = pc.path.getExtension(urlWithoutParams).toLowerCase();
            if (ext === '.dds' || ext === '.ktx') {
                var options = {
                    cache: true,
                    responseType: "arraybuffer",
                    retry: this.retryRequests
                };

                pc.http.get(url.load, options, function (err, response) {
                    if (!err) {
                        callback(null, response);
                    } else {
                        callback(err);
                    }
                });
            } else if ((ext === '.jpg') || (ext === '.jpeg') || (ext === '.gif') || (ext === '.png')) {
                var crossOrigin;
                // only apply cross-origin setting if this is an absolute URL, relative URLs can never be cross-origin
                if (self.crossOrigin !== undefined && pc.ABSOLUTE_URL.test(url.original)) {
                    crossOrigin = self.crossOrigin;
                }

                self._loadImage(url.load, url.original, crossOrigin, callback);
            } else {
                var blobStart = urlWithoutParams.indexOf("blob:");
                if (blobStart >= 0) {
                    urlWithoutParams = urlWithoutParams.substr(blobStart);
                    url = urlWithoutParams;

                    self._loadImage(url, url, null, callback);
                } else {
                    // Unsupported texture extension
                    // Use timeout because asset events can be hooked up after load gets called in some
                    // cases. For example, material loads a texture on 'add' event.
                    setTimeout(function () {
                        callback(pc.string.format("Error loading Texture: format not supported: '{0}'", ext));
                    }, 0);
                }
            }
        },

        _loadImage: function (url, originalUrl, crossOrigin, callback) {
            var image = new Image();
            if (crossOrigin) {
                image.crossOrigin = crossOrigin;
            }

            var retries = 0;
            var maxRetries = 5;
            var retryTimeout;
            var retryRequests = this.retryRequests;

            // Call success callback after opening Texture
            image.onload = function () {
                callback(null, image);
            };

            image.onerror = function () {
                // Retry a few times before failing
                if (retryTimeout) return;

                if (retryRequests && ++retries <= maxRetries) {
                    var retryDelay = Math.pow(2, retries) * 100;
                    console.log(pc.string.format("Error loading Texture from: '{0}' - Retrying in {1}ms...", originalUrl, retryDelay));

                    var idx = url.indexOf('?');
                    var separator = idx >= 0 ? '&' : '?';

                    retryTimeout = setTimeout(function () {
                        // we need to add a cache busting argument if we are trying to re-load an image element
                        // with the same URL
                        image.src = url + separator + 'retry=' + Date.now();
                        retryTimeout = null;
                    }, retryDelay);
                } else {
                    // Call error callback with details.
                    callback(pc.string.format("Error loading Texture from: '{0}'", originalUrl));
                }
            };

            image.src = url;
        },

        open: function (url, data) {
            if (!url)
                return;

            var texture;
            var ext = pc.path.getExtension(url).toLowerCase();
            var format = null;


            // Every browser seems to pass data as an Image type. For some reason, the XDK
            // passes an HTMLImageElement. TODO: figure out why!
            // DDS textures are ArrayBuffers
            if ((data instanceof Image) || (data instanceof HTMLImageElement)) { // PNG, JPG or GIF
                var img = data;

                format = (ext === ".jpg" || ext === ".jpeg") ? pc.PIXELFORMAT_R8_G8_B8 : pc.PIXELFORMAT_R8_G8_B8_A8;
                texture = new pc.Texture(this._device, {
                    // #ifdef PROFILER
                    profilerHint: pc.TEXHINT_ASSET,
                    // #endif
                    width: img.width,
                    height: img.height,
                    format: format
                });
                texture.name = url;
                texture.setSource(img);
            } else if (data instanceof ArrayBuffer) { // Container format
                var LEGACY = true;

                if (LEGACY && ext === '.dds') {
                    texture = _legacyDdsLoader(url, data, this._device);
                } else {
                    var textureData;

                    switch (ext) {
                        case '.dds':
                            textureData = new pc.DdsParser(data);
                            break;
                        case '.ktx':
                            textureData = new pc.KtxParser(data);
                            break;
                        case '.pvr':
                            console.warn('PVR container not supported.');
                            break;
                    }

                    if (!textureData) {
                        // #ifdef DEBUG
                        console.warn("This DDS or KTX pixel format is currently unsupported. Empty texture will be created instead.");
                        // #endif
                        texture = new pc.Texture(this._device, {
                            width: 4,
                            height: 4,
                            format: pc.PIXELFORMAT_R8_G8_B8
                        });
                        texture.name = 'unsupported-empty';
                        return texture;
                    }

                    texture = new pc.Texture(this._device, {
                        // #ifdef PROFILER
                        profilerHint: pc.TEXHINT_ASSET,
                        // #endif
                        addressU: textureData.cubemap ? pc.ADDRESS_CLAMP_TO_EDGE : pc.ADDRESS_REPEAT,
                        addressV: textureData.cubemap ? pc.ADDRESS_CLAMP_TO_EDGE : pc.ADDRESS_REPEAT,
                        width: textureData.width,
                        height: textureData.height,
                        format: textureData.format,
                        cubemap: textureData.cubemap,
                        levels: textureData.levels
                    });

                    texture.name = url;
                    texture.upload();
                }

            }

            return texture;
        },


        patch: function (asset, assets) {
            var texture = asset.resource;

            if (!texture)
                return;

            if (texture.name !== asset.name)
                texture.name = asset.name;

            if (asset.data.hasOwnProperty('minfilter') && texture.minFilter !== JSON_FILTER_MODE[asset.data.minfilter])
                texture.minFilter = JSON_FILTER_MODE[asset.data.minfilter];

            if (asset.data.hasOwnProperty('magfilter') && texture.magFilter !== JSON_FILTER_MODE[asset.data.magfilter])
                texture.magFilter = JSON_FILTER_MODE[asset.data.magfilter];

            if (asset.data.hasOwnProperty('addressu') && texture.addressU !== JSON_ADDRESS_MODE[asset.data.addressu])
                texture.addressU = JSON_ADDRESS_MODE[asset.data.addressu];

            if (asset.data.hasOwnProperty('addressv') && texture.addressV !== JSON_ADDRESS_MODE[asset.data.addressv])
                texture.addressV = JSON_ADDRESS_MODE[asset.data.addressv];

            if (asset.data.hasOwnProperty('mipmaps') && texture.mipmaps !== asset.data.mipmaps)
                texture.mipmaps = asset.data.mipmaps;

            if (asset.data.hasOwnProperty('anisotropy') && texture.anisotropy !== asset.data.anisotropy)
                texture.anisotropy = asset.data.anisotropy;

            var rgbm = !!asset.data.rgbm;
            if (asset.data.hasOwnProperty('rgbm') && texture.rgbm !== rgbm)
                texture.rgbm = rgbm;
        }
    });

    return {
        TextureHandler: TextureHandler
    };
}());
