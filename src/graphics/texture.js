import { Debug } from '../core/debug.js';
import { math } from '../math/math.js';

import {
    ADDRESS_REPEAT,
    FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR,
    FUNC_LESS,
    PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_L8_A8, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R4_G4_B4_A4,
    PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1,
    PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB,
    PIXELFORMAT_ATC_RGBA,
    TEXTURELOCK_WRITE,
    TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_CUBE,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_RGBE, TEXTURETYPE_SWIZZLEGGGR
} from './constants.js';

/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */

let _pixelSizeTable = null;
let _blockSizeTable = null;

/**
 * A texture is a container for texel data that can be utilized in a fragment shader. Typically,
 * the texel data represents an image that is mapped over geometry.
 */
class Texture {
    /**
     * Create a new Texture instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this texture.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {string} [options.name] - The name of the texture.
     * @param {number} [options.width] - The width of the texture in pixels. Defaults to 4.
     * @param {number} [options.height] - The height of the texture in pixels. Defaults to 4.
     * @param {number} [options.depth] - The number of depth slices in a 3D texture (WebGL2 only).
     * Defaults to 1 (single 2D image).
     * @param {number} [options.format] - The pixel format of the texture. Can be:
     *
     * - {@link PIXELFORMAT_A8}
     * - {@link PIXELFORMAT_L8}
     * - {@link PIXELFORMAT_L8_A8}
     * - {@link PIXELFORMAT_R5_G6_B5}
     * - {@link PIXELFORMAT_R5_G5_B5_A1}
     * - {@link PIXELFORMAT_R4_G4_B4_A4}
     * - {@link PIXELFORMAT_R8_G8_B8}
     * - {@link PIXELFORMAT_R8_G8_B8_A8}
     * - {@link PIXELFORMAT_DXT1}
     * - {@link PIXELFORMAT_DXT3}
     * - {@link PIXELFORMAT_DXT5}
     * - {@link PIXELFORMAT_RGB16F}
     * - {@link PIXELFORMAT_RGBA16F}
     * - {@link PIXELFORMAT_RGB32F}
     * - {@link PIXELFORMAT_RGBA32F}
     * - {@link PIXELFORMAT_ETC1}
     * - {@link PIXELFORMAT_PVRTC_2BPP_RGB_1}
     * - {@link PIXELFORMAT_PVRTC_2BPP_RGBA_1}
     * - {@link PIXELFORMAT_PVRTC_4BPP_RGB_1}
     * - {@link PIXELFORMAT_PVRTC_4BPP_RGBA_1}
     * - {@link PIXELFORMAT_111110F}
     * - {@link PIXELFORMAT_ASTC_4x4}>/li>
     * - {@link PIXELFORMAT_ATC_RGB}
     * - {@link PIXELFORMAT_ATC_RGBA}
     *
     * Defaults to {@link PIXELFORMAT_R8_G8_B8_A8}.
     * @param {string} [options.projection] - The projection type of the texture, used when the
     * texture represents an environment. Can be:
     *
     * - {@link TEXTUREPROJECTION_NONE}
     * - {@link TEXTUREPROJECTION_CUBE}
     * - {@link TEXTUREPROJECTION_EQUIRECT}
     * - {@link TEXTUREPROJECTION_OCTAHEDRAL}
     *
     * Defaults to {@link TEXTUREPROJECTION_CUBE} if options.cubemap is specified, otherwise
     * {@link TEXTUREPROJECTION_NONE}.
     * @param {number} [options.minFilter] - The minification filter type to use. Defaults to
     * {@link FILTER_LINEAR_MIPMAP_LINEAR}.
     * @param {number} [options.magFilter] - The magnification filter type to use. Defaults to
     * {@link FILTER_LINEAR}.
     * @param {number} [options.anisotropy] - The level of anisotropic filtering to use. Defaults
     * to 1.
     * @param {number} [options.addressU] - The repeat mode to use in the U direction. Defaults to
     * {@link ADDRESS_REPEAT}.
     * @param {number} [options.addressV] - The repeat mode to use in the V direction. Defaults to
     * {@link ADDRESS_REPEAT}.
     * @param {number} [options.addressW] - The repeat mode to use in the W direction. Defaults to
     * {@link ADDRESS_REPEAT}.
     * @param {boolean} [options.mipmaps] - When enabled try to generate or use mipmaps for this
     * texture. Default is true.
     * @param {boolean} [options.cubemap] - Specifies whether the texture is to be a cubemap.
     * Defaults to false.
     * @param {boolean} [options.volume] - Specifies whether the texture is to be a 3D volume
     * (WebGL2 only). Defaults to false.
     * @param {string} [options.type] - Specifies the image type, see {@link TEXTURETYPE_DEFAULT}.
     * @param {boolean} [options.fixCubemapSeams] - Specifies whether this cubemap texture requires
     * special seam fixing shader code to look right. Defaults to false.
     * @param {boolean} [options.flipY] - Specifies whether the texture should be flipped in the
     * Y-direction. Only affects textures with a source that is an image, canvas or video element.
     * Does not affect cubemaps, compressed textures or textures set from raw pixel data. Defaults
     * to false.
     * @param {boolean} [options.premultiplyAlpha] - If true, the alpha channel of the texture (if
     * present) is multiplied into the color channels. Defaults to false.
     * @param {boolean} [options.compareOnRead] - When enabled, and if texture format is
     * {@link PIXELFORMAT_DEPTH} or {@link PIXELFORMAT_DEPTHSTENCIL}, hardware PCF is enabled for
     * this texture, and you can get filtered results of comparison using texture() in your shader
     * (WebGL2 only). Defaults to false.
     * @param {number} [options.compareFunc] - Comparison function when compareOnRead is enabled
     * (WebGL2 only). Can be:
     *
     * - {@link FUNC_LESS}
     * - {@link FUNC_LESSEQUAL}
     * - {@link FUNC_GREATER}
     * - {@link FUNC_GREATEREQUAL}
     * - {@link FUNC_EQUAL}
     * - {@link FUNC_NOTEQUAL}
     *
     * Defaults to {@link FUNC_LESS}.
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
     */
    constructor(graphicsDevice, options) {
        this.device = graphicsDevice;

        /**
         * The name of the texture. Defaults to null.
         *
         * @type {string}
         */
        this.name = null;

        this._width = 4;
        this._height = 4;
        this._depth = 1;

        this._format = PIXELFORMAT_R8_G8_B8_A8;
        this.type = TEXTURETYPE_DEFAULT;
        this.projection = TEXTUREPROJECTION_NONE;

        this._cubemap = false;
        this._volume = false;
        this.fixCubemapSeams = false;
        this._flipY = false;
        this._premultiplyAlpha = false;

        this._isRenderTarget = false;

        this._mipmaps = true;

        this._minFilter = FILTER_LINEAR_MIPMAP_LINEAR;
        this._magFilter = FILTER_LINEAR;
        this._anisotropy = 1;
        this._addressU = ADDRESS_REPEAT;
        this._addressV = ADDRESS_REPEAT;
        this._addressW = ADDRESS_REPEAT;

        this._compareOnRead = false;
        this._compareFunc = FUNC_LESS;

        // #if _PROFILER
        this.profilerHint = 0;
        // #endif

        if (options !== undefined) {
            if (options.name !== undefined) {
                this.name = options.name;
            }
            this._width = (options.width !== undefined) ? options.width : this._width;
            this._height = (options.height !== undefined) ? options.height : this._height;

            this._format = (options.format !== undefined) ? options.format : this._format;

            if (options.hasOwnProperty('type')) {
                this.type = options.type;
            } else if (options.hasOwnProperty('rgbm')) {
                Debug.deprecated("options.rgbm is deprecated. Use options.type instead.");
                this.type = options.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
            } else if (options.hasOwnProperty('swizzleGGGR')) {
                Debug.deprecated("options.swizzleGGGR is deprecated. Use options.type instead.");
                this.type = options.swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
            }

            if (options.mipmaps !== undefined) {
                this._mipmaps = options.mipmaps;
            } else {
                this._mipmaps = (options.autoMipmap !== undefined) ? options.autoMipmap : this._mipmaps;
            }

            this._levels = options.levels;

            this._cubemap = (options.cubemap !== undefined) ? options.cubemap : this._cubemap;
            this.fixCubemapSeams = (options.fixCubemapSeams !== undefined) ? options.fixCubemapSeams : this.fixCubemapSeams;

            if (this._cubemap) {
                this.projection = TEXTUREPROJECTION_CUBE;
            } else if (options.projection && options.projection !== TEXTUREPROJECTION_CUBE) {
                this.projection = options.projection;
            }

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

            // #if _PROFILER
            this.profilerHint = (options.profilerHint !== undefined) ? options.profilerHint : this.profilerHint;
            // #endif
        }

        this._compressed = (this._format === PIXELFORMAT_DXT1 ||
                            this._format === PIXELFORMAT_DXT3 ||
                            this._format === PIXELFORMAT_DXT5 ||
                            this._format >= PIXELFORMAT_ETC1);

        // Mip levels
        this._invalid = false;
        this._lockedLevel = -1;
        if (!this._levels) {
            this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
        }

        this.dirtyAll();

        this._gpuSize = 0;
    }

    /**
     * The minification filter to be applied to the texture. Can be:
     *
     * - {@link FILTER_NEAREST}
     * - {@link FILTER_LINEAR}
     * - {@link FILTER_NEAREST_MIPMAP_NEAREST}
     * - {@link FILTER_NEAREST_MIPMAP_LINEAR}
     * - {@link FILTER_LINEAR_MIPMAP_NEAREST}
     * - {@link FILTER_LINEAR_MIPMAP_LINEAR}
     *
     * @type {number}
     */
    set minFilter(v) {
        if (this._minFilter !== v) {
            this._minFilter = v;
            this._parameterFlags |= 1;
        }
    }

    get minFilter() {
        return this._minFilter;
    }

    /**
     * The magnification filter to be applied to the texture. Can be:
     *
     * - {@link FILTER_NEAREST}
     * - {@link FILTER_LINEAR}
     *
     * @type {number}
     */
    set magFilter(v) {
        if (this._magFilter !== v) {
            this._magFilter = v;
            this._parameterFlags |= 2;
        }
    }

    get magFilter() {
        return this._magFilter;
    }

    /**
     * The addressing mode to be applied to the texture horizontally. Can be:
     *
     * - {@link ADDRESS_REPEAT}
     * - {@link ADDRESS_CLAMP_TO_EDGE}
     * - {@link ADDRESS_MIRRORED_REPEAT}
     *
     * @type {number}
     */
    set addressU(v) {
        if (this._addressU !== v) {
            this._addressU = v;
            this._parameterFlags |= 4;
        }
    }

    get addressU() {
        return this._addressU;
    }

    /**
     * The addressing mode to be applied to the texture vertically. Can be:
     *
     * - {@link ADDRESS_REPEAT}
     * - {@link ADDRESS_CLAMP_TO_EDGE}
     * - {@link ADDRESS_MIRRORED_REPEAT}
     *
     * @type {number}
     */
    set addressV(v) {
        if (this._addressV !== v) {
            this._addressV = v;
            this._parameterFlags |= 8;
        }
    }

    get addressV() {
        return this._addressV;
    }

    /**
     * The addressing mode to be applied to the 3D texture depth (WebGL2 only). Can be:
     *
     * - {@link ADDRESS_REPEAT}
     * - {@link ADDRESS_CLAMP_TO_EDGE}
     * - {@link ADDRESS_MIRRORED_REPEAT}
     *
     * @type {number}
     */
    set addressW(addressW) {
        if (!this.device.webgl2) return;
        if (!this._volume) {
            Debug.warn("pc.Texture#addressW: Can't set W addressing mode for a non-3D texture.");
            return;
        }
        if (addressW !== this._addressW) {
            this._addressW = addressW;
            this._parameterFlags |= 16;
        }
    }

    get addressW() {
        return this._addressW;
    }

    /**
     * When enabled, and if texture format is {@link PIXELFORMAT_DEPTH} or
     * {@link PIXELFORMAT_DEPTHSTENCIL}, hardware PCF is enabled for this texture, and you can get
     * filtered results of comparison using texture() in your shader (WebGL2 only).
     *
     * @type {boolean}
     */
    set compareOnRead(v) {
        if (this._compareOnRead !== v) {
            this._compareOnRead = v;
            this._parameterFlags |= 32;
        }
    }

    get compareOnRead() {
        return this._compareOnRead;
    }

    /**
     * Comparison function when compareOnRead is enabled (WebGL2 only). Possible values:
     *
     * - {@link FUNC_LESS}
     * - {@link FUNC_LESSEQUAL}
     * - {@link FUNC_GREATER}
     * - {@link FUNC_GREATEREQUAL}
     * - {@link FUNC_EQUAL}
     * - {@link FUNC_NOTEQUAL}
     *
     * @type {number}
     */
    set compareFunc(v) {
        if (this._compareFunc !== v) {
            this._compareFunc = v;
            this._parameterFlags |= 64;
        }
    }

    get compareFunc() {
        return this._compareFunc;
    }

    /**
     * Integer value specifying the level of anisotropic to apply to the texture ranging from 1 (no
     * anisotropic filtering) to the {@link GraphicsDevice} property maxAnisotropy.
     *
     * @type {number}
     */
    set anisotropy(v) {
        if (this._anisotropy !== v) {
            this._anisotropy = v;
            this._parameterFlags |= 128;
        }
    }

    get anisotropy() {
        return this._anisotropy;
    }

    /**
     * Toggles automatic mipmap generation. Can't be used on non power of two textures.
     *
     * @type {boolean}
     * @ignore
     * @deprecated
     */
    set autoMipmap(v) {
        this._mipmaps = v;
    }

    get autoMipmap() {
        return this._mipmaps;
    }

    /**
     * Defines if texture should generate/upload mipmaps if possible.
     *
     * @type {boolean}
     */
    set mipmaps(v) {
        if (this._mipmaps !== v) {
            this._mipmaps = v;
            if (v) this._needsMipmapsUpload = true;
        }
    }

    get mipmaps() {
        return this._mipmaps;
    }

    /**
     * The width of the texture in pixels.
     *
     * @type {number}
     */
    get width() {
        return this._width;
    }

    /**
     * The height of the texture in pixels.
     *
     * @type {number}
     */
    get height() {
        return this._height;
    }

    /**
     * The number of depth slices in a 3D texture (WebGL2 only).
     *
     * @type {number}
     */
    get depth() {
        return this._depth;
    }

    /**
     * The pixel format of the texture. Can be:
     *
     * - {@link PIXELFORMAT_A8}
     * - {@link PIXELFORMAT_L8}
     * - {@link PIXELFORMAT_L8_A8}
     * - {@link PIXELFORMAT_R5_G6_B5}
     * - {@link PIXELFORMAT_R5_G5_B5_A1}
     * - {@link PIXELFORMAT_R4_G4_B4_A4}
     * - {@link PIXELFORMAT_R8_G8_B8}
     * - {@link PIXELFORMAT_R8_G8_B8_A8}
     * - {@link PIXELFORMAT_DXT1}
     * - {@link PIXELFORMAT_DXT3}
     * - {@link PIXELFORMAT_DXT5}
     * - {@link PIXELFORMAT_RGB16F}
     * - {@link PIXELFORMAT_RGBA16F}
     * - {@link PIXELFORMAT_RGB32F}
     * - {@link PIXELFORMAT_RGBA32F}
     * - {@link PIXELFORMAT_ETC1}
     * - {@link PIXELFORMAT_PVRTC_2BPP_RGB_1}
     * - {@link PIXELFORMAT_PVRTC_2BPP_RGBA_1}
     * - {@link PIXELFORMAT_PVRTC_4BPP_RGB_1}
     * - {@link PIXELFORMAT_PVRTC_4BPP_RGBA_1}
     * - {@link PIXELFORMAT_111110F}
     * - {@link PIXELFORMAT_ASTC_4x4}>/li>
     * - {@link PIXELFORMAT_ATC_RGB}
     * - {@link PIXELFORMAT_ATC_RGBA}
     *
     * @type {number}
     */
    get format() {
        return this._format;
    }

    /**
     * Returns true if this texture is a cube map and false otherwise.
     *
     * @type {boolean}
     */
    get cubemap() {
        return this._cubemap;
    }

    get gpuSize() {
        const mips = this.pot && this._mipmaps && !(this._compressed && this._levels.length === 1);
        return Texture.calcGpuSize(this._width, this._height, this._depth, this._format, mips, this._cubemap);
    }

    /**
     * Returns true if this texture is a 3D volume and false otherwise.
     *
     * @type {boolean}
     */
    get volume() {
        return this._volume;
    }

    /**
     * Specifies whether the texture should be flipped in the Y-direction. Only affects textures
     * with a source that is an image, canvas or video element. Does not affect cubemaps,
     * compressed textures or textures set from raw pixel data. Defaults to true.
     *
     * @type {boolean}
     */
    set flipY(flipY) {
        if (this._flipY !== flipY) {
            this._flipY = flipY;
            this._needsUpload = true;
        }
    }

    get flipY() {
        return this._flipY;
    }

    set premultiplyAlpha(premultiplyAlpha) {
        if (this._premultiplyAlpha !== premultiplyAlpha) {
            this._premultiplyAlpha = premultiplyAlpha;
            this._needsUpload = true;
        }
    }

    get premultiplyAlpha() {
        return this._premultiplyAlpha;
    }

    /**
     * Returns true if all dimensions of the texture are power of two, and false otherwise.
     *
     * @type {boolean}
     */
    get pot() {
        return math.powerOfTwo(this._width) && math.powerOfTwo(this._height);
    }

    // get the texture's encoding type
    get encoding() {
        if (this.type === TEXTURETYPE_RGBM) {
            return 'rgbm';
        }

        if (this.type === TEXTURETYPE_RGBE) {
            return 'rgbe';
        }

        if (this.format === PIXELFORMAT_RGBA16F || this.format === PIXELFORMAT_RGBA32F) {
            return 'linear';
        }

        return 'srgb';
    }

    // static functions
    /**
     * Calculate the GPU memory required for a texture.
     *
     * @param {number} width - Texture's width.
     * @param {number} height - Texture's height.
     * @param {number} depth - Texture's depth.
     * @param {number} format - Texture's pixel format PIXELFORMAT_***.
     * @param {boolean} mipmaps - True if the texture includes mipmaps, false otherwise.
     * @param {boolean} cubemap - True is the texture is a cubemap, false otherwise.
     * @returns {number} The number of bytes of GPU memory required for the texture.
     * @ignore
     */
    static calcGpuSize(width, height, depth, format, mipmaps, cubemap) {
        if (!_pixelSizeTable) {
            _pixelSizeTable = [];
            _pixelSizeTable[PIXELFORMAT_A8] = 1;
            _pixelSizeTable[PIXELFORMAT_L8] = 1;
            _pixelSizeTable[PIXELFORMAT_L8_A8] = 2;
            _pixelSizeTable[PIXELFORMAT_R5_G6_B5] = 2;
            _pixelSizeTable[PIXELFORMAT_R5_G5_B5_A1] = 2;
            _pixelSizeTable[PIXELFORMAT_R4_G4_B4_A4] = 2;
            _pixelSizeTable[PIXELFORMAT_R8_G8_B8] = 4;
            _pixelSizeTable[PIXELFORMAT_R8_G8_B8_A8] = 4;
            _pixelSizeTable[PIXELFORMAT_RGB16F] = 8;
            _pixelSizeTable[PIXELFORMAT_RGBA16F] = 8;
            _pixelSizeTable[PIXELFORMAT_RGB32F] = 16;
            _pixelSizeTable[PIXELFORMAT_RGBA32F] = 16;
            _pixelSizeTable[PIXELFORMAT_R32F] = 4;
            _pixelSizeTable[PIXELFORMAT_DEPTH] = 4; // can be smaller using WebGL1 extension?
            _pixelSizeTable[PIXELFORMAT_DEPTHSTENCIL] = 4;
            _pixelSizeTable[PIXELFORMAT_111110F] = 4;
            _pixelSizeTable[PIXELFORMAT_SRGB] = 4;
            _pixelSizeTable[PIXELFORMAT_SRGBA] = 4;
        }

        if (!_blockSizeTable) {
            _blockSizeTable = [];
            _blockSizeTable[PIXELFORMAT_ETC1] = 8;
            _blockSizeTable[PIXELFORMAT_ETC2_RGB] = 8;
            _blockSizeTable[PIXELFORMAT_PVRTC_2BPP_RGB_1] = 8;
            _blockSizeTable[PIXELFORMAT_PVRTC_2BPP_RGBA_1] = 8;
            _blockSizeTable[PIXELFORMAT_PVRTC_4BPP_RGB_1] = 8;
            _blockSizeTable[PIXELFORMAT_PVRTC_4BPP_RGBA_1] = 8;
            _blockSizeTable[PIXELFORMAT_DXT1] = 8;
            _blockSizeTable[PIXELFORMAT_ATC_RGB] = 8;
            _blockSizeTable[PIXELFORMAT_ETC2_RGBA] = 16;
            _blockSizeTable[PIXELFORMAT_DXT3] = 16;
            _blockSizeTable[PIXELFORMAT_DXT5] = 16;
            _blockSizeTable[PIXELFORMAT_ASTC_4x4] = 16;
            _blockSizeTable[PIXELFORMAT_ATC_RGBA] = 16;
        }

        const pixelSize = _pixelSizeTable.hasOwnProperty(format) ? _pixelSizeTable[format] : 0;
        const blockSize = _blockSizeTable.hasOwnProperty(format) ? _blockSizeTable[format] : 0;
        let result = 0;

        while (1) {
            if (pixelSize > 0) {
                // handle uncompressed formats
                result += width * height * depth * pixelSize;
            } else {
                // handle block formats
                let blockWidth = Math.floor((width + 3) / 4);
                const blockHeight = Math.floor((height + 3) / 4);
                const blockDepth = Math.floor((depth + 3) / 4);

                if (format === PIXELFORMAT_PVRTC_2BPP_RGB_1 ||
                    format === PIXELFORMAT_PVRTC_2BPP_RGBA_1) {
                    blockWidth = Math.max(Math.floor(blockWidth / 2), 1);
                }

                result += blockWidth * blockHeight * blockDepth * blockSize;
            }
            // we're done if mipmaps aren't required or we've calculated the smallest mipmap level
            if (!mipmaps || ((width === 1) && (height === 1) && (depth === 1))) {
                break;
            }
            width = Math.max(Math.floor(width / 2), 1);
            height = Math.max(Math.floor(height / 2), 1);
            depth = Math.max(Math.floor(depth / 2), 1);
        }

        return result * (cubemap ? 6 : 1);
    }

    // Public methods
    /**
     * Forcibly free up the underlying WebGL resource owned by the texture.
     */
    destroy() {
        if (this.device) {
            this.device.destroyTexture(this);
        }
        this.device = null;
        this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
    }

    // Force a full resubmission of the texture to WebGL (used on a context restore event)
    dirtyAll() {
        this._levelsUpdated = this._cubemap ? [[true, true, true, true, true, true]] : [true];

        this._needsUpload = true;
        this._needsMipmapsUpload = this._mipmaps;
        this._mipmapsUploaded = false;

        this._parameterFlags = 255; // 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128
    }

    /**
     * Locks a miplevel of the texture, returning a typed array to be filled with pixel data.
     *
     * @param {object} [options] - Optional options object. Valid properties are as follows:
     * @param {number} [options.level] - The mip level to lock with 0 being the top level. Defaults
     * to 0.
     * @param {number} [options.face] - If the texture is a cubemap, this is the index of the face
     * to lock.
     * @param {number} [options.mode] - The lock mode. Can be:
     * - {@link TEXTURELOCK_READ}
     * - {@link TEXTURELOCK_WRITE}
     * Defaults to {@link TEXTURELOCK_WRITE}.
     * @returns {Uint8Array|Uint16Array|Float32Array} A typed array containing the pixel data of
     * the locked mip level.
     */
    lock(options = {}) {
        // Initialize options to some sensible defaults
        if (options.level === undefined) {
            options.level = 0;
        }
        if (options.face === undefined) {
            options.face = 0;
        }
        if (options.mode === undefined) {
            options.mode = TEXTURELOCK_WRITE;
        }

        this._lockedLevel = options.level;

        if (this._levels[options.level] === null) {
            switch (this._format) {
                case PIXELFORMAT_A8:
                case PIXELFORMAT_L8:
                    this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth);
                    break;
                case PIXELFORMAT_L8_A8:
                    this._levels[options.level] = new Uint8Array(this._width * this._height *  this._depth * 2);
                    break;
                case PIXELFORMAT_R5_G6_B5:
                case PIXELFORMAT_R5_G5_B5_A1:
                case PIXELFORMAT_R4_G4_B4_A4:
                    this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth);
                    break;
                case PIXELFORMAT_R8_G8_B8:
                    this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth * 3);
                    break;
                case PIXELFORMAT_R8_G8_B8_A8:
                    this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth * 4);
                    break;
                case PIXELFORMAT_DXT1:
                    this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 8 * this._depth);
                    break;
                case PIXELFORMAT_DXT3:
                case PIXELFORMAT_DXT5:
                    this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 16 * this._depth);
                    break;
                case PIXELFORMAT_RGB16F:
                    this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth * 3);
                    break;
                case PIXELFORMAT_RGB32F:
                    this._levels[options.level] = new Float32Array(this._width * this._height * this._depth * 3);
                    break;
                case PIXELFORMAT_RGBA16F:
                    this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth * 4);
                    break;
                case PIXELFORMAT_RGBA32F:
                    this._levels[options.level] = new Float32Array(this._width * this._height * this._depth * 4);
                    break;
            }
        }

        return this._levels[options.level];
    }

    /**
     * Set the pixel data of the texture from a canvas, image, video DOM element. If the texture is
     * a cubemap, the supplied source must be an array of 6 canvases, images or videos.
     *
     * @param {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement|HTMLCanvasElement[]|HTMLImageElement[]|HTMLVideoElement[]} source - A
     * canvas, image or video element, or an array of 6 canvas, image or video elements.
     * @param {number} [mipLevel] - A non-negative integer specifying the image level of detail.
     * Defaults to 0, which represents the base image source. A level value of N, that is greater
     * than 0, represents the image source for the Nth mipmap reduction level.
     */
    setSource(source, mipLevel = 0) {
        let invalid = false;
        let width, height;

        if (this._cubemap) {
            if (source[0]) {
                // rely on first face sizes
                width = source[0].width || 0;
                height = source[0].height || 0;

                for (let i = 0; i < 6; i++) {
                    const face = source[i];
                    // cubemap becomes invalid if any condition is not satisfied
                    if (!face ||                  // face is missing
                        face.width !== width ||   // face is different width
                        face.height !== height || // face is different height
                        !this.device._isBrowserInterface(face)) {            // new image bitmap
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
                for (let i = 0; i < 6; i++) {
                    if (this._levels[mipLevel][i] !== source[i])
                        this._levelsUpdated[mipLevel][i] = true;
                }
            }
        } else {
            // check if source is valid type of element
            if (!this.device._isBrowserInterface(source))
                invalid = true;

            if (!invalid) {
                // mark level as updated
                if (source !== this._levels[mipLevel])
                    this._levelsUpdated[mipLevel] = true;

                width = source.width;
                height = source.height;
            }
        }

        if (invalid) {
            // invalid texture

            // default sizes
            this._width = 4;
            this._height = 4;

            // remove levels
            if (this._cubemap) {
                for (let i = 0; i < 6; i++) {
                    this._levels[mipLevel][i] = null;
                    this._levelsUpdated[mipLevel][i] = true;
                }
            } else {
                this._levels[mipLevel] = null;
                this._levelsUpdated[mipLevel] = true;
            }
        } else {
            // valid texture
            if (mipLevel === 0) {
                this._width = width;
                this._height = height;
            }

            this._levels[mipLevel] = source;
        }

        // valid or changed state of validity
        if (this._invalid !== invalid || !invalid) {
            this._invalid = invalid;

            // reupload
            this.upload();
        }
    }

    /**
     * Get the pixel data of the texture. If this is a cubemap then an array of 6 images will be
     * returned otherwise a single image.
     *
     * @param {number} [mipLevel] - A non-negative integer specifying the image level of detail.
     * Defaults to 0, which represents the base image source. A level value of N, that is greater
     * than 0, represents the image source for the Nth mipmap reduction level.
     * @returns {HTMLImageElement} The source image of this texture. Can be null if source not
     * assigned for specific image level.
     */
    getSource(mipLevel = 0) {
        return this._levels[mipLevel];
    }

    /**
     * Unlocks the currently locked mip level and uploads it to VRAM.
     */
    unlock() {
        if (this._lockedLevel === -1) {
            Debug.log("pc.Texture#unlock: Attempting to unlock a texture that is not locked.");
        }

        // Upload the new pixel data
        this.upload();
        this._lockedLevel = -1;
    }

    /**
     * Forces a reupload of the textures pixel data to graphics memory. Ordinarily, this function
     * is called by internally by {@link Texture#setSource} and {@link Texture#unlock}. However, it
     * still needs to be called explicitly in the case where an HTMLVideoElement is set as the
     * source of the texture.  Normally, this is done once every frame before video textured
     * geometry is rendered.
     */
    upload() {
        this._needsUpload = true;
        this._needsMipmapsUpload = this._mipmaps;
    }

    /**
     * Generate an in-memory DDS representation of this texture. Only works on RGBA8 textures.
     * Currently, only used by the Editor to write prefiltered cubemaps to DDS format.
     *
     * @returns {ArrayBuffer} Buffer containing the DDS data.
     * @ignore
     */
    getDds() {
        Debug.assert(this.format === PIXELFORMAT_R8_G8_B8_A8, "This format is not implemented yet");

        let fsize = 128;
        let idx = 0;
        while (this._levels[idx]) {
            if (!this.cubemap) {
                const mipSize = this._levels[idx].length;
                if (!mipSize) {
                    Debug.error(`No byte array for mip ${idx}`);
                    return;
                }
                fsize += mipSize;
            } else {
                for (let face = 0; face < 6; face++) {
                    if (!this._levels[idx][face]) {
                        Debug.error(`No level data for mip ${idx}, face ${face}`);
                        return;
                    }
                    const mipSize = this._levels[idx][face].length;
                    if (!mipSize) {
                        Debug.error(`No byte array for mip ${idx}, face ${face}`);
                        return;
                    }
                    fsize += mipSize;
                }
            }
            fsize += this._levels[idx].length;
            idx++;
        }

        const buff = new ArrayBuffer(fsize);
        const header = new Uint32Array(buff, 0, 128 / 4);

        const DDS_MAGIC = 542327876; // "DDS"
        const DDS_HEADER_SIZE = 124;
        const DDS_FLAGS_REQUIRED = 0x01 | 0x02 | 0x04 | 0x1000 | 0x80000; // caps | height | width | pixelformat | linearsize
        const DDS_FLAGS_MIPMAP = 0x20000;
        const DDS_PIXELFORMAT_SIZE = 32;
        const DDS_PIXELFLAGS_RGBA8 = 0x01 | 0x40; // alpha | rgb
        const DDS_CAPS_REQUIRED = 0x1000;
        const DDS_CAPS_MIPMAP = 0x400000;
        const DDS_CAPS_COMPLEX = 0x8;
        const DDS_CAPS2_CUBEMAP = 0x200 | 0x400 | 0x800 | 0x1000 | 0x2000 | 0x4000 | 0x8000; // cubemap | all faces

        let flags = DDS_FLAGS_REQUIRED;
        if (this._levels.length > 1) flags |= DDS_FLAGS_MIPMAP;

        let caps = DDS_CAPS_REQUIRED;
        if (this._levels.length > 1) caps |= DDS_CAPS_MIPMAP;
        if (this._levels.length > 1 || this.cubemap) caps |= DDS_CAPS_COMPLEX;

        const caps2 = this.cubemap ? DDS_CAPS2_CUBEMAP : 0;

        header[0] = DDS_MAGIC;
        header[1] = DDS_HEADER_SIZE;
        header[2] = flags;
        header[3] = this.height;
        header[4] = this.width;
        header[5] = this.width * this.height * 4;
        header[6] = 0; // depth
        header[7] = this._levels.length;
        for (let i = 0; i < 11; i++) {
            header[8 + i] = 0;
        }
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

        let offset = 128;
        if (!this.cubemap) {
            for (let i = 0; i < this._levels.length; i++) {
                const level = this._levels[i];
                const mip = new Uint8Array(buff, offset, level.length);
                for (let j = 0; j < level.length; j++) {
                    mip[j] = level[j];
                }
                offset += level.length;
            }
        } else {
            for (let face = 0; face < 6; face++) {
                for (let i = 0; i < this._levels.length; i++) {
                    const level = this._levels[i][face];
                    const mip = new Uint8Array(buff, offset, level.length);
                    for (let j = 0; j < level.length; j++) {
                        mip[j] = level[j];
                    }
                    offset += level.length;
                }
            }
        }

        return buff;
    }
}

export { Texture };
