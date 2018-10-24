Object.assign(pc, function () {
    'use strict';

    /**
     * @constructor
     * @name pc.Texture
     * @classdesc A texture is a container for texel data that can be utilized in a fragment shader.
     * Typically, the texel data represents an image that is mapped over geometry.
     * @description Creates a new texture.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used to manage this texture.
     * @param {Object} options Object for passing optional arguments.
     * @param {Number} options.width The width of the texture in pixels. Defaults to 4.
     * @param {Number} options.height The height of the texture in pixels. Defaults to 4.
     * @param {Number} options.depth The number of depth slices in a 3D texture (WebGL2 only). Defaults to 1 (single 2D image).
     * @param {Number} options.format The pixel format of the texture. Can be:
     * <ul>
     *     <li>{@link pc.PIXELFORMAT_A8}</li>
     *     <li>{@link pc.PIXELFORMAT_L8}</li>
     *     <li>{@link pc.PIXELFORMAT_L8_A8}</li>
     *     <li>{@link pc.PIXELFORMAT_R5_G6_B5}</li>
     *     <li>{@link pc.PIXELFORMAT_R5_G5_B5_A1}</li>
     *     <li>{@link pc.PIXELFORMAT_R4_G4_B4_A4}</li>
     *     <li>{@link pc.PIXELFORMAT_R8_G8_B8}</li>
     *     <li>{@link pc.PIXELFORMAT_R8_G8_B8_A8}</li>
     *     <li>{@link pc.PIXELFORMAT_DXT1}</li>
     *     <li>{@link pc.PIXELFORMAT_DXT3}</li>
     *     <li>{@link pc.PIXELFORMAT_DXT5}</li>
     *     <li>{@link pc.PIXELFORMAT_RGB16F}</li>
     *     <li>{@link pc.PIXELFORMAT_RGBA16F}</li>
     *     <li>{@link pc.PIXELFORMAT_RGB32F}</li>
     *     <li>{@link pc.PIXELFORMAT_RGBA32F}</li>
     *     <li>{@link pc.PIXELFORMAT_ETC1}</li>
     *     <li>{@link pc.PIXELFORMAT_PVRTC_2BPP_RGB_1}</li>
     *     <li>{@link pc.PIXELFORMAT_PVRTC_2BPP_RGBA_1}</li>
     *     <li>{@link pc.PIXELFORMAT_PVRTC_4BPP_RGB_1}</li>
     *     <li>{@link pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1}</li>
     *     <li>{@link pc.PIXELFORMAT_111110F}</li>
     * </ul>
     * Defaults to pc.PIXELFORMAT_R8_G8_B8_A8.
     * @param {Number} options.minFilter The minification filter type to use. Defaults to {@link pc.FILTER_LINEAR_MIPMAP_LINEAR}
     * @param {Number} options.magFilter The magnification filter type to use. Defaults to {@link pc.FILTER_LINEAR}
     * @param {Number} options.anisotropy The level of anisotropic filtering to use. Defaults to 1
     * @param {Number} options.addressU The repeat mode to use in the U direction. Defaults to {@link pc.ADDRESS_REPEAT}
     * @param {Number} options.addressV The repeat mode to use in the V direction. Defaults to {@link pc.ADDRESS_REPEAT}
     * @param {Boolean} options.mipmaps When enabled try to generate or use mipmaps for this texture. Default is true
     * @param {Boolean} options.cubemap Specifies whether the texture is to be a cubemap. Defaults to false.
     * @param {Boolean} options.volume Specifies whether the texture is to be a 3D volume (WebGL2 only). Defaults to false.
     * @param {Boolean} options.rgbm Specifies whether the texture contains RGBM-encoded HDR data. Defaults to false.
     * @param {Boolean} options.fixCubemapSeams Specifies whether this cubemap texture requires special
     * seam fixing shader code to look right. Defaults to false.
     * @param {Boolean} options.flipY Specifies whether the texture should be flipped in the Y-direction. Only affects textures
     * with a source that is an image, canvas or video element. Does not affect cubemaps, compressed textures or textures set from raw
     * pixel data. Defaults to true.
     * @param {Boolean} options.premultiplyAlpha If true, the alpha channel of the texture (if present) is multiplied into the color
     * channels. Defaults to false.
     * @param {Boolean} options.compareOnRead When enabled, and if texture format is pc.PIXELFORMAT_DEPTH or pc.PIXELFORMAT_DEPTHSTENCIL,
     * hardware PCF is enabled for this texture, and you can get filtered results of comparison using texture() in your shader (WebGL2 only).
     * Defaults to false.
     * @param {Number} options.compareFunc Comparison function when compareOnRead is enabled (WebGL2 only). Defaults to pc.FUNC_LESS.
     * Possible values:
     * <ul>
     *     <li>pc.FUNC_LESS</li>
     *     <li>pc.FUNC_LESSEQUAL</li>
     *     <li>pc.FUNC_GREATER</li>
     *     <li>pc.FUNC_GREATEREQUAL</li>
     *     <li>pc.FUNC_EQUAL</li>
     *     <li>pc.FUNC_NOTEQUAL</li>
     * </ul>
     * @example
     * // Create a 8x8x24-bit texture
     * var texture = new pc.Texture(graphicsDevice, {
     *     width: 8,
     *     height: 8,
     *     format: pc.PIXELFORMAT_R8_G8_B8
     * });
     *
     * // Fill the texture with a gradient
     * var pixels = texture.lock();
     * var count = 0;
     * for (var i = 0; i < 8; i++) {
     *     for (var j = 0; j < 8; j++) {
     *         pixels[count++] = i * 32;
     *         pixels[count++] = j * 32;
     *         pixels[count++] = 255;
     *     }
     * }
     * texture.unlock();
     * @property {String} name The name of the texture. Defaults to null.
     */
    var Texture = function (graphicsDevice, options) {
        this.device = graphicsDevice;

        this.name = null;
        this._width = 4;
        this._height = 4;
        this._depth = 1;
        this._pot = true;

        this._format = pc.PIXELFORMAT_R8_G8_B8_A8;
        this.rgbm = false;

        this._cubemap = false;
        this._volume = false;
        this.fixCubemapSeams = false;
        this._flipY = true;
        this._premultiplyAlpha = false;

        this._mipmaps = true;

        this._minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
        this._magFilter = pc.FILTER_LINEAR;
        this._anisotropy = 1;
        this._addressU = pc.ADDRESS_REPEAT;
        this._addressV = pc.ADDRESS_REPEAT;
        this._addressW = pc.ADDRESS_REPEAT;

        this._compareOnRead = false;
        this._compareFunc = pc.FUNC_LESS;

        // #ifdef PROFILER
        this.profilerHint = 0;
        // #endif

        if (options !== undefined) {
            this._width = (options.width !== undefined) ? options.width : this._width;
            this._height = (options.height !== undefined) ? options.height : this._height;
            this._pot = pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height);

            this._format = (options.format !== undefined) ? options.format : this._format;
            this.rgbm = (options.rgbm !== undefined) ? options.rgbm : this.rgbm;

            if (options.mipmaps !== undefined) {
                this._mipmaps = options.mipmaps;
            } else {
                this._mipmaps = (options.autoMipmap !== undefined) ? options.autoMipmap : this._mipmaps;
            }

            this._levels = options.levels;

            this._cubemap = (options.cubemap !== undefined) ? options.cubemap : this._cubemap;
            this.fixCubemapSeams = (options.fixCubemapSeams !== undefined) ? options.fixCubemapSeams : this.fixCubemapSeams;

            this._minFilter = (options.minFilter !== undefined) ? options.minFilter : this._minFilter;
            this._magFilter = (options.magFilter !== undefined) ? options.magFilter : this._magFilter;
            this._anisotropy = (options.anisotropy !== undefined) ? options.anisotropy : this._anisotropy;
            this._addressU = (options.addressU !== undefined) ? options.addressU : this._addressU;
            this._addressV = (options.addressV !== undefined) ? options.addressV : this._addressV;

            this._compareOnRead = (options.compareOnRead !== undefined) ? options.compareOnRead : this._compareOnRead;
            this._compareFunc = (options._compareFunc !== undefined) ? options._compareFunc : this._compareFunc;

            this._flipY = (options.flipY !== undefined) ? options.flipY : this._flipY;
            this._premultiplyAlpha = (options.premultiplyAlpha !== undefined) ? options.premultiplyAlpha : this._premultiplyAlpha;

            if (graphicsDevice.webgl2) {
                this._depth = (options.depth !== undefined) ? options.depth : this._depth;
                this._volume = (options.volume !== undefined) ? options.volume : this._volume;
                this._addressW = (options.addressW !== undefined) ? options.addressW : this._addressW;
            }

            // #ifdef PROFILER
            this.profilerHint = (options.profilerHint !== undefined) ? options.profilerHint : this.profilerHint;
            // #endif
        }

        this._compressed = (this._format === pc.PIXELFORMAT_DXT1 ||
                            this._format === pc.PIXELFORMAT_DXT3 ||
                            this._format === pc.PIXELFORMAT_DXT5 ||
                            this._format >= pc.PIXELFORMAT_ETC1);

        // Mip levels
        this._invalid = false;
        this._lockedLevel = -1;
        if (!this._levels) {
            this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
        }

        this.dirtyAll();

        this._gpuSize = 0;
    };

    // Public properties
    /**
     * @name pc.Texture#minFilter
     * @type Number
     * @description The minification filter to be applied to the texture. Can be:
     * <ul>
     *     <li>{@link pc.FILTER_NEAREST}</li>
     *     <li>{@link pc.FILTER_LINEAR}</li>
     *     <li>{@link pc.FILTER_NEAREST_MIPMAP_NEAREST}</li>
     *     <li>{@link pc.FILTER_NEAREST_MIPMAP_LINEAR}</li>
     *     <li>{@link pc.FILTER_LINEAR_MIPMAP_NEAREST}</li>
     *     <li>{@link pc.FILTER_LINEAR_MIPMAP_LINEAR}</li>
     * </ul>
     */
    Object.defineProperty(Texture.prototype, 'minFilter', {
        get: function () {
            return this._minFilter;
        },
        set: function (v) {
            if (this._minFilter !== v) {
                this._minFilter = v;
                this._parameterFlags |= 1;
            }
        }
    });

    /**
     * @name pc.Texture#magFilter
     * @type Number
     * @description The magnification filter to be applied to the texture. Can be:
     * <ul>
     *     <li>{@link pc.FILTER_NEAREST}</li>
     *     <li>{@link pc.FILTER_LINEAR}</li>
     * </ul>
     */
    Object.defineProperty(Texture.prototype, 'magFilter', {
        get: function () {
            return this._magFilter;
        },
        set: function (v) {
            if (this._magFilter !== v) {
                this._magFilter = v;
                this._parameterFlags |= 2;
            }
        }
    });

    /**
     * @name pc.Texture#addressU
     * @type Number
     * @description The addressing mode to be applied to the texture horizontally. Can be:
     * <ul>
     *     <li>{@link pc.ADDRESS_REPEAT}</li>
     *     <li>{@link pc.ADDRESS_CLAMP_TO_EDGE}</li>
     *     <li>{@link pc.ADDRESS_MIRRORED_REPEAT}</li>
     * </ul>
     */
    Object.defineProperty(Texture.prototype, 'addressU', {
        get: function () {
            return this._addressU;
        },
        set: function (v) {
            if (this._addressU !== v) {
                this._addressU = v;
                this._parameterFlags |= 4;
            }
        }
    });

    /**
     * @name pc.Texture#addressV
     * @type Number
     * @description The addressing mode to be applied to the texture vertically. Can be:
     * <ul>
     *     <li>{@link pc.ADDRESS_REPEAT}</li>
     *     <li>{@link pc.ADDRESS_CLAMP_TO_EDGE}</li>
     *     <li>{@link pc.ADDRESS_MIRRORED_REPEAT}</li>
     * </ul>
     */
    Object.defineProperty(Texture.prototype, 'addressV', {
        get: function () {
            return this._addressV;
        },
        set: function (v) {
            if (this._addressV !== v) {
                this._addressV = v;
                this._parameterFlags |= 8;
            }
        }
    });

    /**
     * @name pc.Texture#addressW
     * @type Number
     * @description The addressing mode to be applied to the 3D texture depth (WebGL2 only). Can be:
     * <ul>
     *     <li>{@link pc.ADDRESS_REPEAT}</li>
     *     <li>{@link pc.ADDRESS_CLAMP_TO_EDGE}</li>
     *     <li>{@link pc.ADDRESS_MIRRORED_REPEAT}</li>
     * </ul>
     */
    Object.defineProperty(Texture.prototype, 'addressW', {
        get: function () {
            return this._addressW;
        },
        set: function (addressW) {
            if (!this.device.webgl2) return;
            if (!this._volume) {
                // #ifdef DEBUG
                console.warn("pc.Texture#addressW: Can't set W addressing mode for a non-3D texture.");
                // #endif
                return;
            }
            if (addressW !== this._addressW) {
                this._addressW = addressW;
                this._parameterFlags |= 16;
            }
        }
    });

    /**
     * @name pc.Texture#compareOnRead
     * @type Boolean
     * @description When enabled, and if texture format is pc.PIXELFORMAT_DEPTH or pc.PIXELFORMAT_DEPTHSTENCIL,
     * hardware PCF is enabled for this texture, and you can get filtered results of comparison using texture() in your shader (WebGL2 only).
     */
    Object.defineProperty(Texture.prototype, 'compareOnRead', {
        get: function () {
            return this._compareOnRead;
        },
        set: function (v) {
            if (this._compareOnRead !== v) {
                this._compareOnRead = v;
                this._parameterFlags |= 32;
            }
        }
    });

    /**
     * @name pc.Texture#compareFunc
     * @type Number
     * @description Comparison function when compareOnRead is enabled (WebGL2 only).
     * Possible values:
     * <ul>
     *     <li>pc.FUNC_LESS</li>
     *     <li>pc.FUNC_LESSEQUAL</li>
     *     <li>pc.FUNC_GREATER</li>
     *     <li>pc.FUNC_GREATEREQUAL</li>
     *     <li>pc.FUNC_EQUAL</li>
     *     <li>pc.FUNC_NOTEQUAL</li>
     * </ul>
     */
    Object.defineProperty(Texture.prototype, 'compareFunc', {
        get: function () {
            return this._compareFunc;
        },
        set: function (v) {
            if (this._compareFunc !== v) {
                this._compareFunc = v;
                this._parameterFlags |= 64;
            }
        }
    });

    /**
     * @name pc.Texture#anisotropy
     * @type Number
     * @description Integer value specifying the level of anisotropic to apply to the texture
     * ranging from 1 (no anisotropic filtering) to the {@link pc.GraphicsDevice} property maxAnisotropy.
     */
    Object.defineProperty(Texture.prototype, 'anisotropy', {
        get: function () {
            return this._anisotropy;
        },
        set: function (v) {
            if (this._anisotropy !== v) {
                this._anisotropy = v;
                this._parameterFlags |= 128;
            }
        }
    });

    /**
     * @private
     * @deprecated
     * @name pc.Texture#autoMipmap
     * @type Boolean
     * @description Toggles automatic mipmap generation. Can't be used on non power of two textures.
     */
    Object.defineProperty(Texture.prototype, 'autoMipmap', {
        get: function () {
            return this._mipmaps;
        },
        set: function (v) {
            this._mipmaps = v;
        }
    });

    /**
     * @name pc.Texture#mipmaps
     * @type Boolean
     * @description Defines if texture should generate/upload mipmaps if possible.
     */
    Object.defineProperty(Texture.prototype, 'mipmaps', {
        get: function () {
            return this._mipmaps;
        },
        set: function (v) {
            if (this._mipmaps !== v) {
                this._mipmaps = v;
                this._minFilterDirty = true;

                if (v) this._needsMipmapsUpload = true;
            }
        }
    });

    /**
     * @readonly
     * @name pc.Texture#width
     * @type Number
     * @description The width of the texture in pixels.
     */
    Object.defineProperty(Texture.prototype, 'width', {
        get: function () {
            return this._width;
        }
    });

    /**
     * @readonly
     * @name pc.Texture#height
     * @type Number
     * @description The height of the texture in pixels.
     */
    Object.defineProperty(Texture.prototype, 'height', {
        get: function () {
            return this._height;
        }
    });

    /**
     * @readonly
     * @name pc.Texture#depth
     * @type Number
     * @description The number of depth slices in a 3D texture (WebGL2 only).
     */
    Object.defineProperty(Texture.prototype, 'depth', {
        get: function () {
            return this._depth;
        }
    });

    /**
     * @readonly
     * @name pc.Texture#format
     * @type Number
     * @description The pixel format of the texture. Can be:
     * <ul>
     *     <li>{@link pc.PIXELFORMAT_A8}</li>
     *     <li>{@link pc.PIXELFORMAT_L8}</li>
     *     <li>{@link pc.PIXELFORMAT_L8_A8}</li>
     *     <li>{@link pc.PIXELFORMAT_R5_G6_B5}</li>
     *     <li>{@link pc.PIXELFORMAT_R5_G5_B5_A1}</li>
     *     <li>{@link pc.PIXELFORMAT_R4_G4_B4_A4}</li>
     *     <li>{@link pc.PIXELFORMAT_R8_G8_B8}</li>
     *     <li>{@link pc.PIXELFORMAT_R8_G8_B8_A8}</li>
     *     <li>{@link pc.PIXELFORMAT_DXT1}</li>
     *     <li>{@link pc.PIXELFORMAT_DXT3}</li>
     *     <li>{@link pc.PIXELFORMAT_DXT5}</li>
     *     <li>{@link pc.PIXELFORMAT_RGB16F}</li>
     *     <li>{@link pc.PIXELFORMAT_RGBA16F}</li>
     *     <li>{@link pc.PIXELFORMAT_RGB32F}</li>
     *     <li>{@link pc.PIXELFORMAT_RGBA32F}</li>
     *     <li>{@link pc.PIXELFORMAT_ETC1}</li>
     *     <li>{@link pc.PIXELFORMAT_PVRTC_2BPP_RGB_1}</li>
     *     <li>{@link pc.PIXELFORMAT_PVRTC_2BPP_RGBA_1}</li>
     *     <li>{@link pc.PIXELFORMAT_PVRTC_4BPP_RGB_1}</li>
     *     <li>{@link pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1}</li>
     *     <li>{@link pc.PIXELFORMAT_111110F}</li>
     * </ul>
     */
    Object.defineProperty(Texture.prototype, 'format', {
        get: function () {
            return this._format;
        }
    });

    /**
     * @readonly
     * @name pc.Texture#cubemap
     * @type Boolean
     * @description Returns true if this texture is a cube map and false otherwise.
     */
    Object.defineProperty(Texture.prototype, 'cubemap', {
        get: function () {
            return this._cubemap;
        }
    });

    var _pixelFormat2Size = null;

    Object.defineProperty(Texture.prototype, 'gpuSize', {
        get: function () {
            if (!_pixelFormat2Size) {
                _pixelFormat2Size = [];
                _pixelFormat2Size[pc.PIXELFORMAT_A8] = 1;
                _pixelFormat2Size[pc.PIXELFORMAT_L8] = 1;
                _pixelFormat2Size[pc.PIXELFORMAT_L8_A8] = 1;
                _pixelFormat2Size[pc.PIXELFORMAT_R5_G6_B5] = 2;
                _pixelFormat2Size[pc.PIXELFORMAT_R5_G5_B5_A1] = 2;
                _pixelFormat2Size[pc.PIXELFORMAT_R4_G4_B4_A4] = 2;
                _pixelFormat2Size[pc.PIXELFORMAT_R8_G8_B8] = 4;
                _pixelFormat2Size[pc.PIXELFORMAT_R8_G8_B8_A8] = 4;
                _pixelFormat2Size[pc.PIXELFORMAT_RGB16F] = 8;
                _pixelFormat2Size[pc.PIXELFORMAT_RGBA16F] = 8;
                _pixelFormat2Size[pc.PIXELFORMAT_RGB32F] = 16;
                _pixelFormat2Size[pc.PIXELFORMAT_RGBA32F] = 16;
                _pixelFormat2Size[pc.PIXELFORMAT_R32F] = 4;
                _pixelFormat2Size[pc.PIXELFORMAT_DEPTH] = 4; // can be smaller using WebGL1 extension?
                _pixelFormat2Size[pc.PIXELFORMAT_DEPTHSTENCIL] = 4;
                _pixelFormat2Size[pc.PIXELFORMAT_111110F] = 4;
                _pixelFormat2Size[pc.PIXELFORMAT_SRGB] = 4;
                _pixelFormat2Size[pc.PIXELFORMAT_SRGBA] = 4;
            }

            var mips = 1;
            if (this._pot && (this._mipmaps || this._minFilter === pc.FILTER_NEAREST_MIPMAP_NEAREST ||
                this._minFilter === pc.FILTER_NEAREST_MIPMAP_LINEAR || this._minFilter === pc.FILTER_LINEAR_MIPMAP_NEAREST ||
                this._minFilter === pc.FILTER_LINEAR_MIPMAP_LINEAR) && !(this._compressed && this._levels.length === 1)) {

                mips = Math.round(Math.log2(Math.max(this._width, this._height)) + 1);
            }
            var mipWidth = this._width;
            var mipHeight = this._height;
            var mipDepth = this._depth;
            var size = 0;

            for (var i = 0; i < mips; i++) {
                if (!this._compressed) {
                    size += mipWidth * mipHeight * mipDepth * _pixelFormat2Size[this._format];
                } else if (this._format === pc.PIXELFORMAT_ETC1) {
                    size += Math.floor((mipWidth + 3) / 4) * Math.floor((mipHeight + 3) / 4) * 8 * mipDepth;
                } else if (this._format === pc.PIXELFORMAT_PVRTC_2BPP_RGB_1 || this._format === pc.PIXELFORMAT_PVRTC_2BPP_RGBA_1) {
                    size += Math.max(mipWidth, 16) * Math.max(mipHeight, 8) / 4 * mipDepth;
                } else if (this._format === pc.PIXELFORMAT_PVRTC_4BPP_RGB_1 || this._format === pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1) {
                    size += Math.max(mipWidth, 8) * Math.max(mipHeight, 8) / 2 * mipDepth;
                } else {
                    var DXT_BLOCK_WIDTH = 4;
                    var DXT_BLOCK_HEIGHT = 4;
                    var blockSize = this._format === pc.PIXELFORMAT_DXT1 ? 8 : 16;
                    var numBlocksAcross = Math.floor((mipWidth + DXT_BLOCK_WIDTH - 1) / DXT_BLOCK_WIDTH);
                    var numBlocksDown = Math.floor((mipHeight + DXT_BLOCK_HEIGHT - 1) / DXT_BLOCK_HEIGHT);
                    var numBlocks = numBlocksAcross * numBlocksDown;
                    size += numBlocks * blockSize * mipDepth;
                }
                mipWidth = Math.max(mipWidth * 0.5, 1);
                mipHeight = Math.max(mipHeight * 0.5, 1);
                mipDepth = Math.max(mipDepth * 0.5, 1);
            }

            if (this._cubemap) size *= 6;
            return size;
        }
    });

    /**
     * @readonly
     * @name pc.Texture#volume
     * @type Boolean
     * @description Returns true if this texture is a 3D volume and false otherwise.
     */
    Object.defineProperty(Texture.prototype, 'volume', {
        get: function () {
            return this._volume;
        }
    });

    /**
     * @name pc.Texture#flipY
     * @type Boolean
     * @description Specifies whether the texture should be flipped in the Y-direction. Only affects textures
     * with a source that is an image, canvas or video element. Does not affect cubemaps, compressed textures
     * or textures set from raw pixel data. Defaults to true.
     */
    Object.defineProperty(Texture.prototype, 'flipY', {
        get: function () {
            return this._flipY;
        },
        set: function (flipY) {
            if (this._flipY !== flipY) {
                this._flipY = flipY;
                this._needsUpload = true;
            }
        }
    });

    Object.defineProperty(Texture.prototype, 'premultiplyAlpha', {
        get: function () {
            return this._premultiplyAlpha;
        },
        set: function (premultiplyAlpha) {
            if (this._premultiplyAlpha !== premultiplyAlpha) {
                this._premultiplyAlpha = premultiplyAlpha;
                this._needsUpload = true;
            }
        }
    });

    // Public methods
    Object.assign(Texture.prototype, {
        /**
         * @function
         * @name pc.Texture#destroy
         * @description Forcibly free up the underlying WebGL resource owned by the texture.
         */
        destroy: function () {
            if (this.device) {
                this.device.destroyTexture(this);
            }
            this.device = null;
            this._levels = null;
        },

        // Force a full resubmission of the texture to WebGL (used on a context restore event)
        dirtyAll: function () {
            this._levelsUpdated = this._cubemap ? [[true, true, true, true, true, true]] : [true];

            this._needsUpload = true;
            this._needsMipmapsUpload = this._mipmaps;
            this._mipmapsUploaded = false;

            this._parameterFlags = 255; // 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128
        },

        /**
         * @function
         * @name pc.Texture#lock
         * @description Locks a miplevel of the texture, returning a typed array to be filled with pixel data.
         * @param {Object} options Optional options object. Valid properties are as follows:
         * @param {Number} options.level The mip level to lock with 0 being the top level. Defaults to 0.
         * @param {Number} options.face If the texture is a cubemap, this is the index of the face to lock.
         * @returns {ArrayBuffer} A typed array containing the pixel data of the locked mip level.
         */
        lock: function (options) {
            // Initialize options to some sensible defaults
            options = options || { level: 0, face: 0, mode: pc.TEXTURELOCK_WRITE };
            if (options.level === undefined) {
                options.level = 0;
            }
            if (options.face === undefined) {
                options.face = 0;
            }
            if (options.mode === undefined) {
                options.mode = pc.TEXTURELOCK_WRITE;
            }

            this._lockedLevel = options.level;

            if (this._levels[options.level] === null) {
                switch (this._format) {
                    case pc.PIXELFORMAT_A8:
                    case pc.PIXELFORMAT_L8:
                        this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth);
                        break;
                    case pc.PIXELFORMAT_L8_A8:
                        this._levels[options.level] = new Uint8Array(this._width * this._height *  this._depth * 2);
                        break;
                    case pc.PIXELFORMAT_R5_G6_B5:
                    case pc.PIXELFORMAT_R5_G5_B5_A1:
                    case pc.PIXELFORMAT_R4_G4_B4_A4:
                        this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth);
                        break;
                    case pc.PIXELFORMAT_R8_G8_B8:
                        this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth * 3);
                        break;
                    case pc.PIXELFORMAT_R8_G8_B8_A8:
                        this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth * 4);
                        break;
                    case pc.PIXELFORMAT_DXT1:
                        this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 8 * this._depth);
                        break;
                    case pc.PIXELFORMAT_DXT3:
                    case pc.PIXELFORMAT_DXT5:
                        this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 16 * this._depth);
                        break;
                    case pc.PIXELFORMAT_RGB16F:
                        this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth * 3);
                        break;
                    case pc.PIXELFORMAT_RGB32F:
                        this._levels[options.level] = new Float32Array(this._width * this._height * this._depth * 3);
                        break;
                    case pc.PIXELFORMAT_RGBA16F:
                        this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth * 4);
                        break;
                    case pc.PIXELFORMAT_RGBA32F:
                        this._levels[options.level] = new Float32Array(this._width * this._height * this._depth * 4);
                        break;
                }
            }

            return this._levels[options.level];
        },

        /**
         * @function
         * @name pc.Texture#setSource
         * @description Set the pixel data of the texture from a canvas, image, video DOM element. If the
         * texture is a cubemap, the supplied source must be an array of 6 canvases, images or videos.
         * @param {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement|Array} source A canvas, image or video element,
         * or an array of 6 canvas, image or video elements.
         */
        setSource: function (source) {
            var i;
            var invalid = false;
            var width, height;

            if (this._cubemap) {
                if (source[0]) {
                    // rely on first face sizes
                    width = source[0].width || 0;
                    height = source[0].height || 0;

                    for (i = 0; i < 6; i++) {
                        // cubemap becomes invalid if any condition is not satisfied
                        if (!source[i] || // face is missing
                            source[i].width !== width || // face is different width
                            source[i].height !== height || // face is different height
                            (!(source[i] instanceof HTMLImageElement) && // not image and
                            !(source[i] instanceof HTMLCanvasElement) && // not canvas and
                            !(source[i] instanceof HTMLVideoElement))) { // not video

                            invalid = true;
                            break;
                        }
                    }
                } else {
                    // first face is missing
                    invalid = true;
                }

                if (!invalid) {
                    // mark levels as updated
                    for (i = 0; i < 6; i++) {
                        if (this._levels[0][i] !== source[i])
                            this._levelsUpdated[0][i] = true;
                    }
                }
            } else {
                // check if source is valid type of element
                if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement) && !(source instanceof HTMLVideoElement))
                    invalid = true;

                if (!invalid) {
                    // mark level as updated
                    if (source !== this._levels[0])
                        this._levelsUpdated[0] = true;

                    width = source.width;
                    height = source.height;
                }
            }

            if (invalid) {
                // invalid texture

                // default sizes
                this._width = 4;
                this._height = 4;
                this._pot = true;

                // remove levels
                if (this._cubemap) {
                    for (i = 0; i < 6; i++) {
                        this._levels[0][i] = null;
                        this._levelsUpdated[0][i] = true;
                    }
                } else {
                    this._levels[0] = null;
                    this._levelsUpdated[0] = true;
                }
            } else {
                // valid texture
                this._width = width;
                this._height = height;
                this._pot = pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height);

                this._levels[0] = source;
            }

            // valid or changed state of validity
            if (this._invalid !== invalid || !invalid) {
                this._invalid = invalid;

                // reupload
                this.upload();
            }
        },

        /**
         * @function
         * @name pc.Texture#getSource
         * @description Get the pixel data of the texture. If this is a cubemap then an array of 6 images will be returned otherwise
         * a single image.
         * @returns {HTMLImageElement} The source image of this texture.
         */
        getSource: function () {
            return this._levels[0];
        },

        /**
         * @function
         * @name pc.Texture#unlock
         * @description Unlocks the currently locked mip level and uploads it to VRAM.
         */
        unlock: function () {
            // #ifdef DEBUG
            if (this._lockedLevel === -1) {
                console.log("pc.Texture#unlock: Attempting to unlock a texture that is not locked.");
            }
            // #endif

            // Upload the new pixel data
            this.upload();
            this._lockedLevel = -1;
        },

        /**
         * @function
         * @name pc.Texture#upload
         * @description Forces a reupload of the textures pixel data to graphics memory. Ordinarily, this function
         * is called by internally by {@link pc.Texture#setSource} and {@link pc.Texture#unlock}. However, it still needs to
         * be called explicitly in the case where an HTMLVideoElement is set as the source of the texture.  Normally,
         * this is done once every frame before video textured geometry is rendered.
         */
        upload: function () {
            this._needsUpload = true;
            this._needsMipmapsUpload = this._mipmaps;
        },

        getDds: function () {
            if (this.format !== pc.PIXELFORMAT_R8_G8_B8_A8)
                console.error("This format is not implemented yet");

            var fsize = 128;
            var i = 0;
            var j;
            var face;
            while (this._levels[i]) {
                var mipSize;
                if (!this.cubemap) {
                    mipSize = this._levels[i].length;
                    if (!mipSize) {
                        console.error("No byte array for mip " + i);
                        return;
                    }
                    fsize += mipSize;
                } else {
                    for (face = 0; face < 6; face++) {
                        if (!this._levels[i][face]) {
                            console.error('No level data for mip ' + i + ', face ' + face);
                            return;
                        }
                        mipSize = this._levels[i][face].length;
                        if (!mipSize) {
                            console.error("No byte array for mip " + i + ", face " + face);
                            return;
                        }
                        fsize += mipSize;
                    }
                }
                fsize += this._levels[i].length;
                i++;
            }

            var buff = new ArrayBuffer(fsize);
            var header = new Uint32Array(buff, 0, 128 / 4);

            var DDS_MAGIC = 542327876; // "DDS"
            var DDS_HEADER_SIZE = 124;
            var DDS_FLAGS_REQUIRED = 0x01 | 0x02 | 0x04 | 0x1000 | 0x80000; // caps | height | width | pixelformat | linearsize
            var DDS_FLAGS_MIPMAP = 0x20000;
            var DDS_PIXELFORMAT_SIZE = 32;
            var DDS_PIXELFLAGS_RGBA8 = 0x01 | 0x40; // alpha | rgb
            var DDS_CAPS_REQUIRED = 0x1000;
            var DDS_CAPS_MIPMAP = 0x400000;
            var DDS_CAPS_COMPLEX = 0x8;
            var DDS_CAPS2_CUBEMAP = 0x200 | 0x400 | 0x800 | 0x1000 | 0x2000 | 0x4000 | 0x8000; // cubemap | all faces

            var flags = DDS_FLAGS_REQUIRED;
            if (this._levels.length > 1) flags |= DDS_FLAGS_MIPMAP;

            var caps = DDS_CAPS_REQUIRED;
            if (this._levels.length > 1) caps |= DDS_CAPS_MIPMAP;
            if (this._levels.length > 1 || this.cubemap) caps |= DDS_CAPS_COMPLEX;

            var caps2 = this.cubemap ? DDS_CAPS2_CUBEMAP : 0;

            header[0] = DDS_MAGIC;
            header[1] = DDS_HEADER_SIZE;
            header[2] = flags;
            header[3] = this.height;
            header[4] = this.width;
            header[5] = this.width * this.height * 4;
            header[6] = 0; // depth
            header[7] = this._levels.length;
            for (i = 0; i < 11; i++) header[8 + i] = 0;
            header[19] = DDS_PIXELFORMAT_SIZE;
            header[20] = DDS_PIXELFLAGS_RGBA8;
            header[21] = 0; // fourcc
            header[22] = 32; // bpp
            header[23] = 0x00FF0000; // R mask
            header[24] = 0x0000FF00; // G mask
            header[25] = 0x000000FF; // B mask
            header[26] = 0xFF000000; // A mask
            header[27] = caps;
            header[28] = caps2;
            header[29] = 0;
            header[30] = 0;
            header[31] = 0;

            var offset = 128;
            var level, mip;
            if (!this.cubemap) {
                for (i = 0; i < this._levels.length; i++) {
                    level = this._levels[i];
                    mip = new Uint8Array(buff, offset, level.length);
                    for (j = 0; j < level.length; j++) mip[j] = level[j];
                    offset += level.length;
                }
            } else {
                for (face = 0; face < 6; face++) {
                    for (i = 0; i < this._levels.length; i++) {
                        level = this._levels[i][face];
                        mip = new Uint8Array(buff, offset, level.length);
                        for (j = 0; j < level.length; j++) mip[j] = level[j];
                        offset += level.length;
                    }
                }
            }

            return buff;
        }
    });

    return {
        Texture: Texture
    };
}());
