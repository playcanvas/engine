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
    };

    Object.assign(TextureHandler.prototype, {
        load: function (url, callback) {
            var self = this;
            var image;

            var urlWithoutParams = url.indexOf('?') >= 0 ? url.split('?')[0] : url;

            var ext = pc.path.getExtension(urlWithoutParams).toLowerCase();
            if (ext === '.dds') {
                var options = {
                    cache: true,
                    responseType: "arraybuffer"
                };

                pc.http.get(url, options, function (err, response) {
                    if (!err) {
                        callback(null, response);
                    } else {
                        callback(err);
                    }
                });
            } else if ((ext === '.jpg') || (ext === '.jpeg') || (ext === '.gif') || (ext === '.png')) {
                image = new Image();
                // only apply cross-origin setting if this is an absolute URL, relative URLs can never be cross-origin
                if (self.crossOrigin !== undefined && pc.ABSOLUTE_URL.test(url)) {
                    image.crossOrigin = self.crossOrigin;
                }

                // Call success callback after opening Texture
                image.onload = function () {
                    callback(null, image);
                };

                // Call error callback with details.
                image.onerror = function (event) {
                    callback(pc.string.format("Error loading Texture from: '{0}'", url));
                };

                image.src = url;
            } else {
                var blobStart = urlWithoutParams.indexOf("blob:");
                if (blobStart >= 0) {
                    urlWithoutParams = urlWithoutParams.substr(blobStart);
                    url = urlWithoutParams;

                    image = new Image();

                    // Call success callback after opening Texture
                    image.onload = function () {
                        callback(null, image);
                    };

                    // Call error callback with details.
                    image.onerror = function (event) {
                        callback(pc.string.format("Error loading Texture from: '{0}'", url));
                    };

                    image.src = url;
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
                texture.setSource(img);
            } else if (data instanceof ArrayBuffer) { // Container format
                var textureData;

                switch (ext) {
                    case '.dds':
                        // Option 1
                        textureData = new pc.Dds(data);
                        break;
                    case '.ktx':
                        console.warn('KTX container not supported.');
                        break;
                    case '.pvr':
                        console.warn('PVR container not supported.');
                        break;
                }

                if (!textureData) {
                    // #ifdef DEBUG
                    console.warn("This DDS pixel format is currently unsupported. Empty texture will be created instead.");
                    // #endif
                    return new pc.Texture(this._device, {
                        width: 4,
                        height: 4,
                        format: pc.PIXELFORMAT_R8_G8_B8
                    });
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
                    levels: textureData.levels // The pc.Texture constructor needs to be updated to take this property
                });
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
