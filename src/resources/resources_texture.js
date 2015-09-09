pc.extend(pc, function () {
    'use strict';

    var JSON_ADDRESS_MODE = {
        "repeat": pc.ADDRESS_REPEAT,
        "clamp":  pc.ADDRESS_CLAMP_TO_EDGE,
        "mirror": pc.ADDRESS_MIRRORED_REPEAT
    };

    var JSON_FILTER_MODE = {
        "nearest":             pc.FILTER_NEAREST,
        "linear":              pc.FILTER_LINEAR,
        "nearest_mip_nearest": pc.FILTER_NEAREST_MIPMAP_NEAREST,
        "linear_mip_nearest":  pc.FILTER_LINEAR_MIPMAP_NEAREST,
        "nearest_mip_linear":  pc.FILTER_NEAREST_MIPMAP_LINEAR,
        "linear_mip_linear":   pc.FILTER_LINEAR_MIPMAP_LINEAR
    };

    function arrayBufferCopy(src, dst, dstByteOffset, numBytes) {
        dst32Offset = dstByteOffset / 4;
        var tail = (numBytes % 4);
        var src32 = new Uint32Array(src.buffer, 0, (numBytes - tail) / 4);
        var dst32 = new Uint32Array(dst.buffer);
        for (var i = 0; i < src32.length; i++) {
            dst32[dst32Offset + i] = src32[i];
        }
        for (var i = numBytes - tail; i < numBytes; i++) {
            dst[dstByteOffset + i] = src[i];
        }
    }

    var TextureHandler = function (device, assets, loader) {
        this._device = device;
        this._assets = assets;
        this._loader = loader;
        this.crossOrigin = undefined;
    };

    TextureHandler.prototype = {
        load: function (url, callback) {
            var self = this;

            var urlWithoutParams = url.indexOf('?') >= 0 ? url.split('?')[0] : url;

            var ext = pc.path.getExtension(urlWithoutParams).toLowerCase();
            if ((ext === '.dds') || (ext === '.crn')) {
                pc.net.http.get(url, function (response) {
                    callback(null, response);
                }, {
                    cache: true,
                    responseType: 'arraybuffer',
                    error: function (status, xhr, e) {
                        callback(status);
                    }
                });
            } else if ((ext === '.jpg') || (ext === '.jpeg') || (ext === '.gif') || (ext === '.png')) {
                var image = new Image();
                if (self.crossOrigin !== undefined) {
                    image.crossOrigin = self.crossOrigin;
                }

                // Call success callback after opening Texture
                image.onload = function () {
                    callback(null, image);
                };

                // Call error callback with details.
                image.onerror = function (event) {
                    var element = event.srcElement;
                    callback(pc.string.format("Error loading Texture from: '{0}'", element.src));
                };

                image.src = url;
            }
        },

        open: function (url, data) {
            var self = this;
            var texture;
            var ext = pc.path.getExtension(url).toLowerCase();

            // Every browser seems to pass data as an Image type. For some reason, the XDK
            // passes an HTMLImageElement. TODO: figure out why!
            // DDS textures are ArrayBuffers
            if ((data instanceof Image) || (data instanceof HTMLImageElement)) { // PNG, JPG or GIF
                var img = data;

                var format = (ext === ".jpg" || ext === ".jpeg") ? pc.PIXELFORMAT_R8_G8_B8 : pc.PIXELFORMAT_R8_G8_B8_A8;
                texture = new pc.Texture(this._device, {
                    width: img.width,
                    height: img.height,
                    format: format
                });
                texture.setSource(img);

            } else if (data instanceof ArrayBuffer) { // DDS or CRN
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
                var FCC_ETC1 = 826496069; // ETC1

                var format = null;
                var compressed = false;
                var floating = false;
                var etc1 = false;
                if (isFourCc) {
                    if (fcc===FCC_DXT1) {
                        format = pc.PIXELFORMAT_DXT1;
                        compressed = true;
                    } else if (fcc===FCC_DXT5) {
                        format = pc.PIXELFORMAT_DXT5;
                        compressed = true;
                    } else if (fcc===FCC_FP32) {
                        format = pc.PIXELFORMAT_RGBA32F;
                        floating = true;
                    } else if (fcc===FCC_ETC1) {
                        format = pc.PIXELFORMAT_ETC1;
                        compressed = true;
                        etc1 = true;
                    }
                } else {
                    if (bpp===32) {
                        format = pc.PIXELFORMAT_R8_G8_B8_A8;
                    }
                }

                var requiredMips = Math.round(Math.log2(Math.max(width, height)) + 1);
                var cantLoad = !format || (mips !== requiredMips && compressed);
                if (cantLoad) {
                    var errEnd = ". Empty texture will be created instead.";
                    if (!format) {
                        console.error("This DDS pixel format is currently unsupported" + errEnd);
                    } else {
                        console.error("DDS has " + mips + " mips, but engine requires " + requiredMips + " for DXT format. " + errEnd);
                    }
                    texture = new pc.Texture(this._device, {
                        width: 4,
                        height: 4,
                        format: pc.PIXELFORMAT_R8_G8_B8
                    });
                    return texture;
                }

                var texOptions = {
                    width: width,
                    height: height,
                    format: format,
                    cubemap: isCubemap
                };
                texture = new pc.Texture(this._device, texOptions);
                if (isCubemap) {
                    texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                }

                var offset = 128;
                var faces = isCubemap? 6 : 1;
                var mipSize;
                var DXT_BLOCK_WIDTH = 4;
                var DXT_BLOCK_HEIGHT = 4;
                var blockSize = fcc===FCC_DXT1? 8 : 16;
                var numBlocksAcross, numBlocksDown;
                for(var face=0; face<faces; face++) {
                    var mipWidth = width;
                    var mipHeight = height;
                    for(var i=0; i<mips; i++) {
                        if (compressed) {
                            if (etc1) {
                                mipSize = Math.floor((mipWidth + 3) / 4) * Math.floor((mipHeight + 3) / 4) * 8;
                            } else {
                                numBlocksAcross = Math.floor((mipWidth + DXT_BLOCK_WIDTH - 1) / DXT_BLOCK_WIDTH);
                                numBlocksDown = Math.floor((mipHeight + DXT_BLOCK_HEIGHT - 1) / DXT_BLOCK_HEIGHT);
                                numBlocks = numBlocksAcross * numBlocksDown;
                                mipSize = numBlocks * blockSize;
                            }
                        } else {
                            mipSize = mipWidth * mipHeight * 4;
                        }

                        var mipBuff = floating? new Float32Array(data, offset, mipSize) : new Uint8Array(data, offset, mipSize);
                        if (!isCubemap) {
                            texture._levels[i] = mipBuff;
                        } else {
                            if (!texture._levels[i]) texture._levels[i] = [];
                            texture._levels[i][face] = mipBuff;
                        }
                        offset += floating? mipSize * 4 : mipSize;
                        mipWidth = Math.max(mipWidth * 0.5, 1);
                        mipHeight = Math.max(mipHeight * 0.5, 1);
                    }
                }

                texture.upload();
            }
            return texture;
        },

        patch: function (asset, assets) {
            var texture = asset.resource;

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

            if (asset.data.hasOwnProperty('anisotropy') && texture.anisotropy !== asset.data.anisotropy)
                texture.anisotropy = asset.data.anisotropy;

            if (asset.data.hasOwnProperty('rgbm') && texture.rgbm !== !! asset.data.rgbm)
                texture.rgbm = !! asset.data.rgbm;
        }
    };

    return {
        TextureHandler: TextureHandler,
    };
}());
