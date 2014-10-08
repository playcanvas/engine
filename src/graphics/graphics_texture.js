pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.Texture
     * @class A texture is a container for texel data that can be utilized in a fragment shader.
     * Typically, the texel data represents an image that is mapped over geometry.
     * @constructor Creates a new texture.
     * @param {pc.gfx.Device} graphicsDevice The graphics device used to manage this texture.
     * @param {Object} options Options that control the main properties of a texture.
     * @property {Number} minFilter The minification filter to be applied to the texture (see pc.gfx.FILTER_*).
     * @property {Number} magFilter The magnification filter to be applied to the texture (see pc.gfx.FILTER_*).
     * @property {Number} addressU The addressing mode to be applied to the texture (see pc.gfx.ADDRESS_*).
     * @property {Number} addressV The addressing mode to be applied to the texture (see pc.gfx.ADDRESS_*).
     * @property {Number} maxAnisotropy Integer value specifying the level of anisotropic to apply to the texture
     * ranging from 1 (no anisotropic filtering) to the pc.gfx.Device property maxSupportedMaxAnisotropy.
     * @property {Number} width [Read only] The width of the based mip level in pixels.
     * @property {Number} height [Read only] The height of the based mip level in pixels.
     * @property {Number} format [Read only] The pixel format of the texture (see pc.gfx.PIXELFORMAT_*).
     * @author Will Eastcott
     */
    var Texture = function (graphicsDevice, options) {
        this.device = graphicsDevice;

        // Defaults
        var width = 4;
        var height = 4;
        var format = pc.gfx.PIXELFORMAT_R8_G8_B8_A8;
        var cubemap = false;
        var autoMipmap = true;

        if (typeof options !== 'undefined') {
            width = (typeof options.width !== 'undefined') ? options.width : width;
            height = (typeof options.height !== 'undefined') ? options.height : height;
            format = (typeof options.format !== 'undefined') ? options.format : format;
            cubemap = (typeof options.cubemap !== 'undefined') ? options.cubemap : cubemap;
            autoMipmap = (typeof options.autoMipmap !== 'undefined') ? options.autoMipmap : autoMipmap;
        }

        // PUBLIC
        this.name = null;
        this.autoMipmap = autoMipmap;

        // PRIVATE
        var gl = this.device.gl;
        var ext;
        this._glTextureId = gl.createTexture();
        this._glTarget = cubemap ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D;

        this._cubemap = cubemap;

        this._format = format;
        switch (format) {
            case pc.gfx.PIXELFORMAT_A8:
                this._glFormat = gl.ALPHA;
                this._glInternalFormat = gl.ALPHA;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case pc.gfx.PIXELFORMAT_L8:
                this._glFormat = gl.LUMINANCE;
                this._glInternalFormat = gl.LUMINANCE;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case pc.gfx.PIXELFORMAT_L8_A8:
                this._glFormat = gl.LUMINANCE_ALPHA;
                this._glInternalFormat = gl.LUMINANCE_ALPHA;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case pc.gfx.PIXELFORMAT_R5_G6_B5:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.RGB;
                this._glPixelType = gl.UNSIGNED_SHORT_5_6_5;
                break;
            case pc.gfx.PIXELFORMAT_R5_G5_B5_A1:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA;
                this._glPixelType = gl.UNSIGNED_SHORT_5_5_5_1;
                break;
            case pc.gfx.PIXELFORMAT_R4_G4_B4_A4:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA;
                this._glPixelType = gl.UNSIGNED_SHORT_4_4_4_4;
                break;
            case pc.gfx.PIXELFORMAT_R8_G8_B8:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.RGB;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case pc.gfx.PIXELFORMAT_R8_G8_B8_A8:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case pc.gfx.PIXELFORMAT_DXT1:
                ext = this.device.extCompressedTextureS3TC;
                this._glFormat = gl.RGB;
                this._glInternalFormat = ext.COMPRESSED_RGB_S3TC_DXT1_EXT;
                break;
            case pc.gfx.PIXELFORMAT_DXT3:
                ext = this.device.extCompressedTextureS3TC;
                this._glFormat = gl.RGBA;
                this._glInternalFormat = ext.COMPRESSED_RGBA_S3TC_DXT3_EXT;
                break;
            case pc.gfx.PIXELFORMAT_DXT5:
                ext = this.device.extCompressedTextureS3TC;
                this._glFormat = gl.RGBA;
                this._glInternalFormat = ext.COMPRESSED_RGBA_S3TC_DXT5_EXT;
                break;
            case pc.gfx.PIXELFORMAT_RGB16F:
                ext = this.device.extTextureHalfFloat;
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.RGB;
                this._glPixelType = ext.HALF_FLOAT_OES;
                break;
            case pc.gfx.PIXELFORMAT_RGBA16F:
                ext = this.device.extTextureHalfFloat;
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA;
                this._glPixelType = ext.HALF_FLOAT_OES;
                break;
            case pc.gfx.PIXELFORMAT_RGB32F:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.RGB;
                this._glPixelType = gl.FLOAT;
                break;
            case pc.gfx.PIXELFORMAT_RGBA32F:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA;
                this._glPixelType = gl.FLOAT;
                break;
        }
        this._compressed = ((format === pc.gfx.PIXELFORMAT_DXT1) ||
                            (format === pc.gfx.PIXELFORMAT_DXT3) ||
                            (format === pc.gfx.PIXELFORMAT_DXT5));

        // Set the new texture to be 4x4 (minimum supported texture size)
        this._width = width || 4;
        this._height = height || 4;

        // These values are the defaults as specified by the WebGL spec
        this._addressu = pc.gfx.ADDRESS_REPEAT;
        this._addressv = pc.gfx.ADDRESS_REPEAT;
        this._minFilter = pc.gfx.FILTER_NEAREST_MIPMAP_LINEAR;
        this._magFilter = pc.gfx.FILTER_LINEAR;
        this._maxAnisotropy = 1;

        // Mip levels
        this._levels = cubemap ? [[ null, null, null, null, null, null ]] : [ null ];
        this._lockedLevel = -1;

        this.upload();
    };

    // Public properties
    Object.defineProperty(Texture.prototype, 'minFilter', {
        get: function() { return this._minFilter; },
        set: function(filter) {
            if (!(pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height))) {
                if (!((filter === pc.gfx.FILTER_NEAREST) || (filter === pc.gfx.FILTER_LINEAR)))  {
                    logWARNING("Invalid filter mode set on non power of two texture. Forcing linear addressing.");
                    filter = pc.gfx.FILTER_LINEAR;
                }
            }
            this.bind();
            var gl = this.device.gl;
            var _filterLookup = [gl.NEAREST, gl.LINEAR, gl.NEAREST_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR, gl.LINEAR_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_LINEAR];
            gl.texParameteri(this._glTarget, gl.TEXTURE_MIN_FILTER, _filterLookup[filter]);
            this._minFilter = filter;
        }
    });

    Object.defineProperty(Texture.prototype, 'magFilter', {
        get: function() { return this._magFilter; },
        set: function(magFilter) {
            if (!((magFilter === pc.gfx.FILTER_NEAREST) || (magFilter === pc.gfx.FILTER_LINEAR)))  {
                logWARNING("Invalid maginication filter mode. Must be set to FILTER_NEAREST or FILTER_LINEAR.");
            }
            this.bind();
            var gl = this.device.gl;
            var _filterLookup = [gl.NEAREST, gl.LINEAR, gl.NEAREST_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR, gl.LINEAR_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_LINEAR];
            gl.texParameteri(this._glTarget, gl.TEXTURE_MAG_FILTER, _filterLookup[magFilter]);
            this._magFilter = magFilter;
        }
    });

    Object.defineProperty(Texture.prototype, 'addressU', {
        get: function() { return this._addressu; },
        set: function(addressu) {
            if (!(pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height))) {
                if (addressu !== pc.gfx.ADDRESS_CLAMP_TO_EDGE) {
                    logWARNING("Invalid address mode in U set on non power of two texture. Forcing clamp to edge addressing.");
                    addressu = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
                }
            }
            this.bind();
            var gl = this.device.gl;
            var _addressLookup = [gl.REPEAT, gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT];
            gl.texParameteri(this._glTarget, gl.TEXTURE_WRAP_S, _addressLookup[addressu]);
            this._addressu = addressu;
        }
    });

    Object.defineProperty(Texture.prototype, 'addressV', {
        get: function() { return this._addressv; },
        set: function(addressv) {
            if (!(pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height))) {
                if (addressv !== pc.gfx.ADDRESS_CLAMP_TO_EDGE) {
                    logWARNING("Invalid address mode in V set on non power of two texture. Forcing clamp to edge addressing.");
                    addressv = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
                }
            }
            this.bind();
            var gl = this.device.gl;
            var _addressLookup = [gl.REPEAT, gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT];
            gl.texParameteri(this._glTarget, gl.TEXTURE_WRAP_T, _addressLookup[addressv]);
            this._addressv = addressv;
        }
    });

    Object.defineProperty(Texture.prototype, 'maxAnisotropy', {
        get: function() { return this._maxAnisotropy; },
        set: function(maxAnisotropy) {
            this._maxAnisotropy = maxAnisotropy;

            var device = this.device;
            var ext = device.extTextureFilterAnisotropic;
            if (ext) {
                this.bind();
                var gl = device.gl;
                maxAnisotropy = Math.min(maxAnisotropy, device.maxSupportedMaxAnisotropy);
                gl.texParameterf(this._glTarget, ext.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy);
            }
        }
    });

    Object.defineProperty(Texture.prototype, 'width', {
        get: function() { return this._width; }
    });

    Object.defineProperty(Texture.prototype, 'height', {
        get: function() { return this._height; }
    });

    Object.defineProperty(Texture.prototype, 'format', {
        get: function() { return this._format; }
    });

    // Public methods
    pc.extend(Texture.prototype, {
        /**
         * @function
         * @name pc.gfx.Texture#bind
         * @description Activates the specified texture on the current texture unit.
         */
        bind: function () {
            var gl = this.device.gl;
            gl.bindTexture(this._glTarget, this._glTextureId);
        },

        /**
         * @function
         * @name pc.gfx.Texture#destroy
         * @description Forcibly free up the underlying WebGL resource owned by the texture.
         */
        destroy: function () {
            var gl = this.device.gl;
            gl.deleteTexture(this._glTextureId);
        },

        /**
         * @function
         * @name pc.gfx.Texture#lock
         * @description Locks a miplevel of the texture, returning a typed array to be filled with pixel data.
         * @param {Object} options Optional options object. Valid properties are as follows:
         * @param {Number} options.level The mip level to lock with 0 being the top level. Defaults to 0.
         * @param {Number} options.face If the texture is a cubemap, this is the index of the face to lock.
         */
        lock: function (options) {
            // Initialize options to some sensible defaults
            options = options || { level: 0, face: 0, mode: pc.gfx.TEXTURELOCK_WRITE };
            if (options.level === undefined) { options.level = 0; }
            if (options.face === undefined) { options.face = 0; }
            if (options.mode === undefined) { options.mode = pc.gfx.TEXTURELOCK_WRITE; }

            this._lockedLevel = options.level;

            if (this._levels[options.level] === null) {
                switch(this._format) {
                    case pc.gfx.PIXELFORMAT_A8:
                    case pc.gfx.PIXELFORMAT_L8:
                        this._levels[options.level] = new Uint8Array(this._width * this._height);
                        break;
                    case pc.gfx.PIXELFORMAT_L8_A8:
                        this._levels[options.level] = new Uint8Array(this._width * this._height * 2);
                        break;
                    case pc.gfx.PIXELFORMAT_R5_G6_B5:
                    case pc.gfx.PIXELFORMAT_R5_G5_B5_A1:
                    case pc.gfx.PIXELFORMAT_R4_G4_B4_A4:
                        this._levels[options.level] = new Uint16Array(this._width * this._height);
                        break;
                    case pc.gfx.PIXELFORMAT_R8_G8_B8:
                        this._levels[options.level] = new Uint8Array(this._width * this._height * 3);
                        break;
                    case pc.gfx.PIXELFORMAT_R8_G8_B8_A8:
                        this._levels[options.level] = new Uint8Array(this._width * this._height * 4);
                        break;
                    case pc.gfx.PIXELFORMAT_DXT1:
                        this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 8);
                        break;
                    case pc.gfx.PIXELFORMAT_DXT3:
                    case pc.gfx.PIXELFORMAT_DXT5:
                        this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 16);
                        break;
                    case pc.gfx.PIXELFORMAT_RGB16F:
                    case pc.gfx.PIXELFORMAT_RGB32F:
                        this._levels[options.level] = new Float32Array(this._width * this._height * 3);
                        break;
                    case pc.gfx.PIXELFORMAT_RGBA16F:
                    case pc.gfx.PIXELFORMAT_RGBA32F:
                        this._levels[options.level] = new Float32Array(this._width * this._height * 4);
                        break;
                }
            }

            return this._levels[options.level];
        },

        /**
         * @function
         * @name pc.gfx.Texture#recover
         * @description Restores the texture in the event of the underlying WebGL context being lost and then
         * restored.
         */
        recover: function () {
            var gl = this.device.gl;
            this._glTextureId = gl.createTexture();
            this.addressU = this._addressu;
            this.addressV = this._addressv;
            this.minFilter = this._minFilter;
            this.magFilter = this._magFilter;
            this.maxAnisotropy = this._maxAnisotropy;
            this.upload();
        },

        /**
         * @function
         * @name pc.gfx.Texture#load
         * @description Load 6 Image resources to use as the sources of the texture.
         * @param {Array} urls A list of 6 URLs for the image resources to load
         * @param {pc.resources.ResourceLoader} loader The ResourceLoader to fetch the resources with
         * @param {Number} [batch] A existing RequestBatch handle to append this request to.
         */
        load: function (src, loader, requestBatch) {
            if (this._cubemap) {
                var options = {
                    batch: requestBatch
                };

                var requests = src.map(function (url) {
                    return new pc.resources.ImageRequest(url);
                });

                loader.request(requests).then(function (resources) {
                    this.setSource(resources);
                }.bind(this));
            } else {
                var request = new pc.resources.ImageRequest(src);

                loader.request(request).then(function (resources) {
                    this.setSource(resources[0]);
                }.bind(this));
            }
        },

        /**
         * @function
         * @name pc.gfx.Texture#setSource
         * @description Set the pixel data of the texture from an canvas, image, video DOM element. If the
         * texture is a cubemap, the supplied source must be an array of 6 canvases, images or videos.
         * @param {Array} source Array of 6 HTMLCanvasElement, HTMLImageElement or HTMLVideoElement objects.
         * for the specified texture.
         */
        setSource: function (source) {
            if (this._cubemap) {
                // Check a valid source has been passed in
                logASSERT(Object.prototype.toString.apply(source) === '[object Array]', "pc.gfx.Texture: setSource: supplied source is not an array");
                logASSERT(source.length === 6, "pc.gfx.Texture: setSource: supplied source does not have 6 entries.");
                var validTypes = 0;
                var validDimensions = true;
                var width = source[0].width;
                var height = source[0].height;
                for (var i = 0; i < 6; i++) {
                    if ((source[i] instanceof HTMLCanvasElement) ||
                        (source[i] instanceof HTMLImageElement) ||
                        (source[i] instanceof HTMLVideoElement)) {
                        validTypes++;
                    }
                    if (source[i].width !== width) validDimensions = false;
                    if (source[i].height !== height) validDimensions = false;
                }
                logASSERT(validTypes === 6, "pc.gfx.Texture: setSource: Not all supplied source elements are of required type (canvas, image or video).");
                logASSERT(validDimensions,  "pc.gfx.Texture: setSource: Not all supplied source elements share the same dimensions.");

                // If there are mip levels allocated, blow them away
                this._width  = source[0].width;
                this._height = source[0].height;
                this._levels[0] = source;
            } else {
                // Check a valid source has been passed in
                logASSERT((source instanceof HTMLCanvasElement) || (source instanceof HTMLImageElement) || (source instanceof HTMLVideoElement),
                    "pc.gfx.Texture: setSource: supplied source is not an instance of HTMLCanvasElement, HTMLImageElement or HTMLVideoElement.");

                this._width  = source.width;
                this._height = source.height;
                this._levels[0] = source;
            }

            this.upload();
            // Reset filter and address modes because width/height may have changed
            this.minFilter = this._minFilter;
            this.magFilter = this._magFilter;
            this.addressu = this._addressu;
            this.addressv = this._addressv;
        },

        /**
         * @function
         * @name pc.gfx.Texture#getSource
         * @description Get the pixel data of the texture. If this is a cubemap then an array of 6 images will be returned otherwise
         * a single image.
         * @return {Image} The source image of this texture.
         */
        getSource: function () {
            return this._levels[0];
        },

        /**
         * @function
         * @name pc.gfx.Texture#unlock
         * @description Unlocks the currently locked mip level and uploads it to VRAM.
         */
        unlock: function () {
            logASSERT(this._lockedLevel !== -1, "Attempting to unlock a texture that is not locked");

            // Upload the new pixel data
            this.upload();
            this._lockedLevel = -1;
        },

        /**
         * @function
         * @name pc.gfx.Texture#upload
         * @description Forces a reupload of the textures pixel data to graphics memory. Ordinarily, this function
         * is called by internally by pc.gfx.Texture#setSource and pc.gfx.Texture#unlock. However, it still needs to
         * be called explicitly in the case where an HTMLVideoElement is set as the source of the texture.  Normally,
         * this is done once every frame before video textured geometry is rendered.
         */
        upload: function () {
            this.bind();

            var gl = this.device.gl;
            var pixels = this._levels[0];

            if (this._cubemap) {
                var face;

                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
                if ((pixels[0] instanceof HTMLCanvasElement) || (pixels[0] instanceof HTMLImageElement) || (pixels[0] instanceof HTMLVideoElement)) {
                    // Upload the image, canvas or video
                    for (face = 0; face < 6; face++) {
                        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, this._glInternalFormat, this._glFormat, this._glPixelType, pixels[face]);
                    }
                } else {
                    // Upload the byte array
                    for (face = 0; face < 6; face++) {
                        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, this._glInternalFormat, this._width, this._height, 0, this._glFormat, this._glPixelType, pixels[face]);
                    }
                }
            } else {
                if ((pixels instanceof HTMLCanvasElement) || (pixels instanceof HTMLImageElement) || (pixels instanceof HTMLVideoElement)) {
                    // Upload the image, canvas or video
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
                    gl.texImage2D(gl.TEXTURE_2D, 0, this._glInternalFormat, this._glFormat, this._glPixelType, pixels);
                } else {
                    // Upload the byte array
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    if (this._compressed) {
                        gl.compressedTexImage2D(gl.TEXTURE_2D, 0, this._glInternalFormat, this._width, this._height, 0, pixels);
                    } else {
                        gl.texImage2D(gl.TEXTURE_2D, 0, this._glInternalFormat, this._width, this._height, 0, this._glFormat, this._glPixelType, pixels);
                    }
                }
            }

            if (this.autoMipmap && pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height) && this._levels.length === 1) {
                gl.generateMipmap(this._glTarget);
            }
        }
    });

    return {
        Texture: Texture
    };
}());
