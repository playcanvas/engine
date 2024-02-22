import { Debug } from '../../core/debug.js';
import { TRACEID_TEXTURE_ALLOC, TRACEID_VRAM_TEXTURE } from '../../core/constants.js';
import { math } from '../../core/math/math.js';

import { RenderTarget } from './render-target.js';
import { TextureUtils } from './texture-utils.js';
import {
    isCompressedPixelFormat,
    getPixelFormatArrayType,
    ADDRESS_REPEAT,
    FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR,
    FUNC_LESS,
    PIXELFORMAT_RGBA8,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F,
    TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP,
    TEXTURELOCK_WRITE,
    TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_CUBE,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_RGBE, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR,
    isIntegerPixelFormat, FILTER_NEAREST, TEXTURELOCK_NONE, TEXTURELOCK_READ
} from './constants.js';

let id = 0;

/**
 * A texture is a container for texel data that can be utilized in a fragment shader. Typically,
 * the texel data represents an image that is mapped over geometry.
 *
 * @category Graphics
 */
class Texture {
    /**
     * The name of the texture.
     *
     * @type {string}
     */
    name;

    /** @ignore */
    _gpuSize = 0;

    /** @protected */
    id = id++;

    /** @protected */
    _invalid = false;

    /** @protected */
    _lockedLevel = -1;

    /** @protected */
    _lockedMode = TEXTURELOCK_NONE;

    /**
     * A render version used to track the last time the texture properties requiring bind group
     * to be updated were changed.
     *
     * @type {number}
     * @ignore
     */
    renderVersionDirty = 0;

    /** @protected */
    _storage = false;

    /**
     * Create a new Texture instance.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this texture.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {string} [options.name] - The name of the texture. Defaults to null.
     * @param {number} [options.width] - The width of the texture in pixels. Defaults to 4.
     * @param {number} [options.height] - The height of the texture in pixels. Defaults to 4.
     * @param {number} [options.depth] - The number of depth slices in a 3D texture (not supported by WebGl1).
     * @param {number} [options.format] - The pixel format of the texture. Can be:
     *
     * - {@link PIXELFORMAT_A8}
     * - {@link PIXELFORMAT_L8}
     * - {@link PIXELFORMAT_LA8}
     * - {@link PIXELFORMAT_RGB565}
     * - {@link PIXELFORMAT_RGBA5551}
     * - {@link PIXELFORMAT_RGBA4}
     * - {@link PIXELFORMAT_RGB8}
     * - {@link PIXELFORMAT_RGBA8}
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
     * - {@link PIXELFORMAT_ASTC_4x4}
     * - {@link PIXELFORMAT_ATC_RGB}
     * - {@link PIXELFORMAT_ATC_RGBA}
     *
     * Defaults to {@link PIXELFORMAT_RGBA8}.
     * @param {string} [options.projection] - The projection type of the texture, used when the
     * texture represents an environment. Can be:
     *
     * - {@link TEXTUREPROJECTION_NONE}
     * - {@link TEXTUREPROJECTION_CUBE}
     * - {@link TEXTUREPROJECTION_EQUIRECT}
     * - {@link TEXTUREPROJECTION_OCTAHEDRAL}
     *
     * Defaults to {@link TEXTUREPROJECTION_CUBE} if options.cubemap is true, otherwise
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
     * @param {number} [options.arrayLength] - Specifies whether the texture is to be a 2D texture array.
     * When passed in as undefined or < 1, this is not an array texture. If >= 1, this is an array texture.
     * (not supported by WebGL1). Defaults to undefined.
     * @param {boolean} [options.volume] - Specifies whether the texture is to be a 3D volume
     * (not supported by WebGL1). Defaults to false.
     * @param {string} [options.type] - Specifies the texture type.  Can be:
     *
     * - {@link TEXTURETYPE_DEFAULT}
     * - {@link TEXTURETYPE_RGBM}
     * - {@link TEXTURETYPE_RGBE}
     * - {@link TEXTURETYPE_RGBP}
     * - {@link TEXTURETYPE_SWIZZLEGGGR}
     *
     * Defaults to {@link TEXTURETYPE_DEFAULT}.
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
     * (not supported by WebGL1). Defaults to false.
     * @param {number} [options.compareFunc] - Comparison function when compareOnRead is enabled
     * (not supported by WebGL1). Can be:
     *
     * - {@link FUNC_LESS}
     * - {@link FUNC_LESSEQUAL}
     * - {@link FUNC_GREATER}
     * - {@link FUNC_GREATEREQUAL}
     * - {@link FUNC_EQUAL}
     * - {@link FUNC_NOTEQUAL}
     *
     * Defaults to {@link FUNC_LESS}.
     * @param {Uint8Array[]|HTMLCanvasElement[]|HTMLImageElement[]|HTMLVideoElement[]|Uint8Array[][]} [options.levels]
     * - Array of Uint8Array or other supported browser interface; or a two-dimensional array
     * of Uint8Array if options.arrayLength is defined and greater than zero.
     * @param {boolean} [options.storage] - Defines if texture can be used as a storage texture by
     * a compute shader. Defaults to false.
     * @example
     * // Create a 8x8x24-bit texture
     * const texture = new pc.Texture(graphicsDevice, {
     *     width: 8,
     *     height: 8,
     *     format: pc.PIXELFORMAT_RGB8
     * });
     *
     * // Fill the texture with a gradient
     * const pixels = texture.lock();
     * const count = 0;
     * for (let i = 0; i < 8; i++) {
     *     for (let j = 0; j < 8; j++) {
     *         pixels[count++] = i * 32;
     *         pixels[count++] = j * 32;
     *         pixels[count++] = 255;
     *     }
     * }
     * texture.unlock();
     */
    constructor(graphicsDevice, options = {}) {
        this.device = graphicsDevice;
        Debug.assert(this.device, "Texture constructor requires a graphicsDevice to be valid");
        Debug.assert(!options.width || Number.isInteger(options.width), "Texture width must be an integer number, got", options);
        Debug.assert(!options.height || Number.isInteger(options.height), "Texture height must be an integer number, got", options);
        Debug.assert(!options.depth || Number.isInteger(options.depth), "Texture depth must be an integer number, got", options);

        this.name = options.name ?? '';

        this._width = Math.floor(options.width ?? 4);
        this._height = Math.floor(options.height ?? 4);

        this._format = options.format ?? PIXELFORMAT_RGBA8;
        this._compressed = isCompressedPixelFormat(this._format);
        this._integerFormat = isIntegerPixelFormat(this._format);
        if (this._integerFormat) {
            options.mipmaps = false;
            options.minFilter = FILTER_NEAREST;
            options.magFilter = FILTER_NEAREST;
        }

        if (graphicsDevice.supportsVolumeTextures) {
            this._volume = options.volume ?? false;
            this._depth = Math.floor(options.depth ?? 1);
            this._arrayLength = Math.floor(options.arrayLength ?? 0);
        } else {
            this._volume = false;
            this._depth = 1;
            this._arrayLength = 0;
        }

        this._storage = options.storage ?? false;
        this._cubemap = options.cubemap ?? false;
        this.fixCubemapSeams = options.fixCubemapSeams ?? false;
        this._flipY = options.flipY ?? false;
        this._premultiplyAlpha = options.premultiplyAlpha ?? false;

        this._mipmaps = options.mipmaps ?? options.autoMipmap ?? true;
        this._minFilter = options.minFilter ?? FILTER_LINEAR_MIPMAP_LINEAR;
        this._magFilter = options.magFilter ?? FILTER_LINEAR;
        this._anisotropy = options.anisotropy ?? 1;
        this._addressU = options.addressU ?? ADDRESS_REPEAT;
        this._addressV = options.addressV ?? ADDRESS_REPEAT;
        this._addressW = options.addressW ?? ADDRESS_REPEAT;

        this._compareOnRead = options.compareOnRead ?? false;
        this._compareFunc = options.compareFunc ?? FUNC_LESS;

        this.type = TEXTURETYPE_DEFAULT;
        if (options.hasOwnProperty('type')) {
            this.type = options.type;
        } else if (options.hasOwnProperty('rgbm')) {
            Debug.deprecated("options.rgbm is deprecated. Use options.type instead.");
            this.type = options.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
        } else if (options.hasOwnProperty('swizzleGGGR')) {
            Debug.deprecated("options.swizzleGGGR is deprecated. Use options.type instead.");
            this.type = options.swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
        }

        this.projection = TEXTUREPROJECTION_NONE;
        if (this._cubemap) {
            this.projection = TEXTUREPROJECTION_CUBE;
        } else if (options.projection && options.projection !== TEXTUREPROJECTION_CUBE) {
            this.projection = options.projection;
        }

        this.impl = graphicsDevice.createTextureImpl(this);

        // #if _PROFILER
        this.profilerHint = options.profilerHint ?? 0;
        // #endif

        this.dirtyAll();

        this._levels = options.levels;
        if (this._levels) {
            this.upload();
        } else {
            this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
        }

        // track the texture
        graphicsDevice.textures.push(this);

        Debug.trace(TRACEID_TEXTURE_ALLOC, `Alloc: Id ${this.id} ${this.name}: ${this.width}x${this.height} ` +
            `${this.cubemap ? '[Cubemap]' : ''}` +
            `${this.volume ? '[Volume]' : ''}` +
            `${this.array ? '[Array]' : ''}` +
            `${this.mipmaps ? '[Mipmaps]' : ''}`, this);
    }

    /**
     * Frees resources associated with this texture.
     */
    destroy() {

        Debug.trace(TRACEID_TEXTURE_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);

        const device = this.device;
        if (device) {
            // stop tracking the texture
            const idx = device.textures.indexOf(this);
            if (idx !== -1) {
                device.textures.splice(idx, 1);
            }

            // Remove texture from any uniforms
            device.scope.removeValue(this);

            // destroy implementation
            this.impl.destroy(device);

            // Update texture stats
            this.adjustVramSizeTracking(device._vram, -this._gpuSize);

            this._levels = null;
            this.device = null;
        }
    }

    /**
     * Resizes the texture. Only supported for render target textures, as it does not resize the
     * existing content of the texture, but only the allocated buffer for rendering into.
     *
     * @param {number} width - The new width of the texture.
     * @param {number} height - The new height of the texture.
     * @param {number} [depth] - The new depth of the texture. Defaults to 1.
     * @ignore
     */
    resize(width, height, depth = 1) {

        // destroy texture impl
        const device = this.device;
        this.adjustVramSizeTracking(device._vram, -this._gpuSize);
        this.impl.destroy(device);

        this._width = Math.floor(width);
        this._height = Math.floor(height);
        this._depth = Math.floor(depth);

        // re-create the implementation
        this.impl = device.createTextureImpl(this);
        this.dirtyAll();
    }

    /**
     * Called when the rendering context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        this.impl.loseContext();
        this.dirtyAll();
    }

    /**
     * Updates vram size tracking for the texture, size can be positive to add or negative to subtract
     *
     * @ignore
     */
    adjustVramSizeTracking(vram, size) {

        Debug.trace(TRACEID_VRAM_TEXTURE, `${this.id} ${this.name} size: ${size} vram.texture: ${vram.tex} => ${vram.tex + size}`);

        vram.tex += size;

        // #if _PROFILER
        if (this.profilerHint === TEXHINT_SHADOWMAP) {
            vram.texShadow += size;
        } else if (this.profilerHint === TEXHINT_ASSET) {
            vram.texAsset += size;
        } else if (this.profilerHint === TEXHINT_LIGHTMAP) {
            vram.texLightmap += size;
        }
        // #endif
    }

    propertyChanged(flag) {
        this.impl.propertyChanged(flag);
        this.renderVersionDirty = this.device.renderVersion;
    }

    /**
     * Returns number of required mip levels for the texture based on its dimensions and parameters.
     *
     * @ignore
     * @type {number}
     */
    get requiredMipLevels() {
        return this.mipmaps ? TextureUtils.calcMipLevelsCount(this.width, this.height) : 1;
    }

    /**
     * Returns the current lock mode. One of:
     *
     * - {@link TEXTURELOCK_NONE}
     * - {@link TEXTURELOCK_READ}
     * - {@link TEXTURELOCK_WRITE}
     *
     * @ignore
     * @type {number}
     */
    get lockedMode() {
        return this._lockedMode;
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
            if (isIntegerPixelFormat(this._format)) {
                Debug.warn("Texture#minFilter: minFilter property cannot be changed on an integer texture, will remain FILTER_NEAREST", this);
            } else {
                this._minFilter = v;
                this.propertyChanged(1);
            }
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
            if (isIntegerPixelFormat(this._format)) {
                Debug.warn("Texture#magFilter: magFilter property cannot be changed on an integer texture, will remain FILTER_NEAREST", this);
            } else {
                this._magFilter = v;
                this.propertyChanged(2);
            }
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
            this.propertyChanged(4);
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
            this.propertyChanged(8);
        }
    }

    get addressV() {
        return this._addressV;
    }

    /**
     * The addressing mode to be applied to the 3D texture depth (not supported on WebGL1). Can be:
     *
     * - {@link ADDRESS_REPEAT}
     * - {@link ADDRESS_CLAMP_TO_EDGE}
     * - {@link ADDRESS_MIRRORED_REPEAT}
     *
     * @type {number}
     */
    set addressW(addressW) {
        if (!this.device.supportsVolumeTextures) return;
        if (!this._volume) {
            Debug.warn("pc.Texture#addressW: Can't set W addressing mode for a non-3D texture.");
            return;
        }
        if (addressW !== this._addressW) {
            this._addressW = addressW;
            this.propertyChanged(16);
        }
    }

    get addressW() {
        return this._addressW;
    }

    /**
     * When enabled, and if texture format is {@link PIXELFORMAT_DEPTH} or
     * {@link PIXELFORMAT_DEPTHSTENCIL}, hardware PCF is enabled for this texture, and you can get
     * filtered results of comparison using texture() in your shader (not supported on WebGL1).
     *
     * @type {boolean}
     */
    set compareOnRead(v) {
        if (this._compareOnRead !== v) {
            this._compareOnRead = v;
            this.propertyChanged(32);
        }
    }

    get compareOnRead() {
        return this._compareOnRead;
    }

    /**
     * Comparison function when compareOnRead is enabled (not supported on WebGL1). Possible values:
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
            this.propertyChanged(64);
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
            this.propertyChanged(128);
        }
    }

    get anisotropy() {
        return this._anisotropy;
    }

    /**
     * Defines if texture should generate/upload mipmaps if possible.
     *
     * @type {boolean}
     */
    set mipmaps(v) {
        if (this._mipmaps !== v) {

            if (this.device.isWebGPU) {
                Debug.warn("Texture#mipmaps: mipmap property is currently not allowed to be changed on WebGPU, create the texture appropriately.", this);
            } else if (isIntegerPixelFormat(this._format)) {
                Debug.warn("Texture#mipmaps: mipmap property cannot be changed on an integer texture, will remain false", this);
            } else {
                this._mipmaps = v;
            }

            if (v) this._needsMipmapsUpload = true;
        }
    }

    get mipmaps() {
        return this._mipmaps;
    }

    /**
     * Defines if texture can be used as a storage texture by a compute shader.
     *
     * @type {boolean}
     */
    get storage() {
        return this._storage;
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
     * The number of depth slices in a 3D texture.
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
     * - {@link PIXELFORMAT_LA8}
     * - {@link PIXELFORMAT_RGB565}
     * - {@link PIXELFORMAT_RGBA5551}
     * - {@link PIXELFORMAT_RGBA4}
     * - {@link PIXELFORMAT_RGB8}
     * - {@link PIXELFORMAT_RGBA8}
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
        return TextureUtils.calcGpuSize(this._width, this._height, this._depth, this._format, mips, this._cubemap);
    }

    /**
     * Returns true if this texture is a 2D texture array and false otherwise.
     *
     * @type {boolean}
     */
    get array() {
        return this._arrayLength > 0;
    }

    /**
     * Returns the number of textures inside this texture if this is a 2D array texture or 0 otherwise.
     *
     * @type {number}
     */
    get arrayLength() {
        return this._arrayLength;
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
        switch (this.type) {
            case TEXTURETYPE_RGBM:
                return 'rgbm';
            case TEXTURETYPE_RGBE:
                return 'rgbe';
            case TEXTURETYPE_RGBP:
                return 'rgbp';
            default:
                return (this.format === PIXELFORMAT_RGB16F ||
                        this.format === PIXELFORMAT_RGB32F ||
                        this.format === PIXELFORMAT_RGBA16F ||
                        this.format === PIXELFORMAT_RGBA32F ||
                        isIntegerPixelFormat(this.format)) ? 'linear' : 'srgb';
        }
    }

    // Force a full resubmission of the texture to the GPU (used on a context restore event)
    dirtyAll() {
        this._levelsUpdated = this._cubemap ? [[true, true, true, true, true, true]] : [true];

        this._needsUpload = true;
        this._needsMipmapsUpload = this._mipmaps;
        this._mipmapsUploaded = false;

        this.propertyChanged(255);  // 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128
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
        options.level ??= 0;
        options.face ??= 0;
        options.mode ??= TEXTURELOCK_WRITE;

        Debug.assert(
            this._lockedMode === TEXTURELOCK_NONE,
            'The texture is already locked. Call `texture.unlock()` before attempting to lock again.',
            this
        );

        Debug.assert(
            options.mode === TEXTURELOCK_READ || options.mode === TEXTURELOCK_WRITE,
            'Cannot lock a texture with TEXTURELOCK_NONE. To unlock a texture, call `texture.unlock()`.',
            this
        );

        this._lockedMode = options.mode;
        this._lockedLevel = options.level;

        const levels = this.cubemap ? this._levels[options.face] : this._levels;
        if (levels[options.level] === null) {
            // allocate storage for this mip level
            const width = Math.max(1, this._width >> options.level);
            const height = Math.max(1, this._height >> options.level);
            const depth = Math.max(1, this._depth >> options.level);
            const data = new ArrayBuffer(TextureUtils.calcLevelGpuSize(width, height, depth, this._format));
            levels[options.level] = new (getPixelFormatArrayType(this._format))(data);
        }

        return levels[options.level];
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
        if (this._lockedMode === TEXTURELOCK_NONE) {
            Debug.warn("pc.Texture#unlock: Attempting to unlock a texture that is not locked.", this);
        }

        // Upload the new pixel data if locked in write mode (default)
        if (this._lockedMode === TEXTURELOCK_WRITE) {
            this.upload();
        }
        this._lockedLevel = -1;
        this._lockedMode = TEXTURELOCK_NONE;
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
        this.impl.uploadImmediate?.(this.device, this);
    }

    /**
     * Download texture's top level data from graphics memory to local memory.
     *
     * @ignore
     */
    async downloadAsync() {
        const promises = [];
        for (let i = 0; i < (this.cubemap ? 6 : 1); i++) {
            const renderTarget = new RenderTarget({
                colorBuffer: this,
                depth: false,
                face: i
            });

            this.device.setRenderTarget(renderTarget);
            this.device.initRenderTarget(renderTarget);

            const levels = this.cubemap ? this._levels[i] : this._levels;

            let level = levels[0];
            if (levels[0] && this.device._isBrowserInterface(levels[0])) {
                levels[0] = null;
            }

            level = this.lock({ face: i });

            const promise = this.device.readPixelsAsync?.(0, 0, this.width, this.height, level)
                .then(() => renderTarget.destroy());

            promises.push(promise);
        }
        await Promise.all(promises);
    }
}

export { Texture };
