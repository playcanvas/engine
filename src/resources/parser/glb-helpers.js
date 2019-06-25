Object.assign(pc, function () {
    'use strict';

    function isDataURI(uri) {
        return /^data:.*,.*$/i.test(uri);
    }

    var GLBHelpers = {};

    GLBHelpers.BuffersLoader = function (context, continuation) {
        this._context = context;
        this._continuation = continuation;
        this._numLoaded = 0;
    };

    GLBHelpers.BuffersLoader.prototype.progressLoading = function () {
        if (++this._numLoaded === this._context.gltf.buffers.length) {
            this._continuation();
        }
    };

    GLBHelpers.BuffersLoader._onProcessURIload = function (loader, result) {
        loader._context.buffers[idx] = result;
        loader.progressLoading();
    };

    GLBHelpers.BuffersLoader._onXHRload = function (loader, e) {
        // response is unsigned 8 bit integer
        loader._context.buffers[idx] = this.response;
        loader.progressLoading();
    };

    GLBHelpers.BuffersLoader.prototype.load = function () {
        // buffers already loaded so early out
        if (!this._context.buffers) {
            this._context.buffers = [];

            var gltf = this._context.gltf;
            if (!gltf.hasOwnProperty('buffers')) {
                this._context._onLoaded(null);
                return;
            }

            for (var buffer, idx = 0; idx < gltf.buffers.length; idx++) {
                buffer = gltf.buffers[idx];
                if (buffer.hasOwnProperty('uri')) {
                    if (isDataURI(buffer.uri)) {
                        // convert base64 to raw binary data held in a string
                        // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
                        var byteString = atob(buffer.uri.split(',')[1]);

                        // write the bytes of the string to an ArrayBuffer
                        this.buffers[idx] = new ArrayBuffer(byteString.length);

                        // create a view into the buffer
                        var uint8Array = new Uint8Array(this.buffers[idx]);

                        // set the bytes of the buffer to the correct values
                        for (var i = 0; i < byteString.length; i++) {
                            uint8Array[i] = byteString.charCodeAt(i);
                        }
                        this.progressLoading();
                    } else if (this._context.processUri) {
                        this._context.processUri(buffer.uri, GLBHelpers.BuffersLoader._onProcessURIload.bind(this));
                    } else {
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', this._context.basePath + buffer.uri, true);
                        xhr.responseType = 'arraybuffer';
                        xhr.onload = GLBHelpers.BuffersLoader._onXHRload.bind(this);
                        xhr.send();
                    }
                }
            }
        }
    };

    GLBHelpers.ImageLoader = function (context, continuation) {
        this._context = context;
        this._continuation = continuation;
        this._imagesLoaded = 0;

        if (!this._context.gltf.hasOwnProperty(property) || this._context.gltf[property].length === 0) {
            this._continuation();
        }
    };

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#image
    function resampleImage(image) {
        var srcW = image.width;
        var srcH = image.height;

        var dstW = nearestPow2(srcW);
        var dstH = nearestPow2(srcH);

        var canvas = document.createElement('canvas');
        canvas.width = dstW;
        canvas.height = dstH;

        var context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, srcW, srcH, 0, 0, dstW, dstH);

        return canvas.toDataURL();
    }

    GLBHelpers.ImageLoader.prototype.onLoad = function (image) {
        image.removeEventListener('load', this.onLoad, false);

        var gltf = this._context.gltf;

        var imageIndex = this._context.images.indexOf(image);
        for (var idx = 0; idx < gltf.textures.length; idx++) {
            var texture = gltf.textures[idx];
            if (texture.hasOwnProperty('source')) {
                if (texture.source === imageIndex) {
                    var t = this._context.textures[idx];
                    if ((!isPowerOf2(image.width) || !isPowerOf2(image.width)) &&
                        ((t.addressU === pc.ADDRESS_REPEAT) || (t.addressU === pc.ADDRESS_MIRRORED_REPEAT) ||
                         (t.addressV === pc.ADDRESS_REPEAT) || (t.addressV === pc.ADDRESS_MIRRORED_REPEAT) ||
                         (t.minFilter === pc.FILTER_LINEAR_MIPMAP_LINEAR) || (t.minFilter === pc.FILTER_NEAREST_MIPMAP_LINEAR) ||
                         (t.minFilter === pc.FILTER_LINEAR_MIPMAP_NEAREST) || (t.minFilter === pc.FILTER_NEAREST_MIPMAP_NEAREST))) {

                        var potImage = new Image();
                        potImage.addEventListener('load', t.setSource.bind(t, potImage));
                        potImage.src = resampleImage(image);
                    } else {
                        t.setSource(image);
                    }
                }
            }
        }

        if (++this._imagesLoaded === gltf.images.length) {
            this._continuation();
        }
    };

    GLBHelpers.ImageLoader.prototype.translate = function (context, data) {
        var image = new Image();
        image.addEventListener('load', this.onLoad.bind(this), false);

        if (data.hasOwnProperty('uri')) {
            if (isDataURI(data.uri)) {
                image.src = data.uri;
            } else if (this._context.processUri) {
                this._context.processUri(data.uri, function (uri) {
                    image.crossOrigin = "anonymous";
                    image.src = uri;
                });
            } else {
                image.crossOrigin = "anonymous";
                image.src = this._context.basePath + data.uri;
            }
        }

        if (data.hasOwnProperty('bufferView')) {
            var gltf = this._context.gltf;
            var buffers = this._context.buffers;
            var bufferView = gltf.bufferViews[data.bufferView];
            var arrayBuffer = buffers[bufferView.buffer];
            var byteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
            var imageBuffer = arrayBuffer.slice(byteOffset, byteOffset + bufferView.byteLength);
            var blob = new Blob([imageBuffer], { type: data.mimeType });
            image.src = URL.createObjectURL(blob);
        }

        return image;
    };

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#texture
    GLBHelpers.translateTexture = function (context, data) {
        var texture = new pc.Texture(context._device, {
            flipY: false
        });

        if (data.hasOwnProperty('name')) {
            texture.name = data.name;
        }

        if (data.hasOwnProperty('sampler')) {
            var gltf = resources.gltf;
            var sampler = gltf.samplers[data.sampler];

            if (sampler.hasOwnProperty('minFilter')) {
                texture.minFilter = getFilter(sampler.minFilter);
            }
            if (sampler.hasOwnProperty('magFilter')) {
                texture.magFilter = getFilter(sampler.magFilter);
            }
            if (sampler.hasOwnProperty('wrapS')) {
                texture.addressU = getWrap(sampler.wrapS);
            }
            if (sampler.hasOwnProperty('wrapT')) {
                texture.addressV = getWrap(sampler.wrapT);
            }
        }

        return texture;
    };

    return {
        GLBHelpers: GLBHelpers
    };
}());
