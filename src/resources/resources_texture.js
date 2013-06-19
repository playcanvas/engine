pc.extend(pc.resources, function () {
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

    var TextureResourceHandler = function (device) {
        this._device = device;
    };
    TextureResourceHandler = pc.inherits(TextureResourceHandler, pc.resources.ResourceHandler);
    
    TextureResourceHandler.prototype.load = function (request, options) {
        var identifier = request.canonical;

        var promise = new RSVP.Promise(function (resolve, reject) {
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
                // Call success callback after opening Texture
                image.onload = function () {
                    resolve(image);
                };

                // Call error callback with details.
                image.onerror = function (event) {
                    var element = event.srcElement;
                    reject(pc.string.format("Error loading Texture from: '{0}'", element.src));
                };
                image.src = identifier;
            }
        });
    
        return promise;
    };

    TextureResourceHandler.prototype.open = function (data, request, options) {
        var texture;

        if (data instanceof Image) { // PNG, JPG or GIF
            var img = data;
            if (request.result) {
                texture = request.result;
            } else {            
                texture = new pc.gfx.Texture(this._device, {
                    width: img.width,
                    height: img.height,
                    format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8
                });
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