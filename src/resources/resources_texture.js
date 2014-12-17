pc.extend(pc.resources, function () {
    var jsonToAddressMode = {
        "repeat": pc.gfx.ADDRESS_REPEAT,
        "clamp":  pc.gfx.ADDRESS_CLAMP_TO_EDGE,
        "mirror": pc.gfx.ADDRESS_MIRRORED_REPEAT
    };

    var jsonToFilterMode = {
        "nearest":             pc.gfx.FILTER_NEAREST,
        "linear":              pc.gfx.FILTER_LINEAR,
        "nearest_mip_nearest": pc.gfx.FILTER_NEAREST_MIPMAP_NEAREST,
        "linear_mip_nearest":  pc.gfx.FILTER_LINEAR_MIPMAP_NEAREST,
        "nearest_mip_linear":  pc.gfx.FILTER_NEAREST_MIPMAP_LINEAR,
        "linear_mip_linear":   pc.gfx.FILTER_LINEAR_MIPMAP_LINEAR
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

    var TextureResourceHandler = function (device, assets) {
        this._device = device;
        this._assets = assets;
        this.crossOrigin = undefined;
    };
    TextureResourceHandler = pc.inherits(TextureResourceHandler, pc.resources.ResourceHandler);

    TextureResourceHandler.prototype.load = function (request, options) {
        var identifier = request.canonical;
        var self = this;

        var promise = new pc.promise.Promise(function (resolve, reject) {
            var ext = pc.path.getExtension(identifier).toLowerCase();
            if ((ext === '.dds') || (ext === '.crn')) {
                options = options || {};
                options.binary = true;
                options.directory = pc.path.getDirectory(identifier);
                options.crn = (ext === '.crn');

                pc.net.http.get(identifier, function (response) {
                    resolve(response);
                }, {
                    cache: false
                });
            } else if ((ext === '.jpg') || (ext === '.jpeg') || (ext === '.gif') || (ext === '.png')) {
                var image = new Image();
                if (self.crossOrigin !== undefined) {
                    image.crossOrigin = self.crossOrigin;
                }

                // Call success callback after opening Texture
                image.onload = function () {
                    resolve(image);
                };

                // Call error callback with details.
                image.onerror = function (event) {
                    var element = event.srcElement;
                    reject(pc.string.format("Error loading Texture from: '{0}'", element.src));
                };

                var asset = self._assets.getAssetByUrl(request.canonical);
                if (asset && asset.file) {
                    identifier += '?t=' + asset.file.hash;
                }

                image.src = identifier;
            }
        });

        return promise;
    };

    TextureResourceHandler.prototype.open = function (data, request, options) {
        var self = this;
        var texture;

        // Every browser seems to pass data as an Image type. For some reason, the XDK
        // passes an HTMLImageElement. TODO: figure out why!
        if ((data instanceof Image) || (data instanceof HTMLImageElement)) { // PNG, JPG or GIF
            var img = data;
            if (request.result) {
                texture = request.result;
            } else {
                format = pc.string.endsWith(img.src.toLowerCase(), '.jpg') ? pc.gfx.PIXELFORMAT_R8_G8_B8 : pc.gfx.PIXELFORMAT_R8_G8_B8_A8;
                texture = new pc.gfx.Texture(this._device, {
                    width: img.width,
                    height: img.height,
                    format: format
                });

                var asset = self._assets.getAssetByUrl(request.canonical);
                if (asset && asset.data) {
                    // check if data exists - it might not exist for engine-only users
                    if (asset.data.name !== undefined) texture.name = asset.data.name;
                    if (asset.data.addressu !== undefined) texture.addressU = jsonToAddressMode[asset.data.addressu];
                    if (asset.data.addressV !== undefined) texture.addressV = jsonToAddressMode[asset.data.addressV];
                    if (asset.data.magfilter !== undefined) texture.magFilter = jsonToFilterMode[asset.data.magfilter];
                    if (asset.data.minfilter !== undefined) texture.minfilter = jsonToFilterMode[asset.data.minfilter];
                }
            }
            texture.setSource(img);
        } else if (data instanceof ArrayBuffer) { // DDS or CRN
            if (options.crn) {
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

            texture = loadDDS(data);
        }
        return texture;
    };

    var TextureRequest = function TextureRequest(identifier) {
    };
    TextureRequest = pc.inherits(TextureRequest, pc.resources.ResourceRequest);
    TextureRequest.prototype.type = "texture";
    TextureRequest.prototype.Type = pc.gfx.Texture;

    return {
        TextureResourceHandler: TextureResourceHandler,
        TextureRequest: TextureRequest
    };
}());
