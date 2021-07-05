import { path } from '../core/path.js';

import {
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT,
    FILTER_LINEAR, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR,
    PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR
} from '../graphics/constants.js';
import { Texture } from '../graphics/texture.js';

import { BasisParser } from './parser/texture/basis.js';
import { ImgParser } from './parser/texture/img.js';
import { KtxParser } from './parser/texture/ktx.js';
import { LegacyDdsParser } from './parser/texture/legacy-dds.js';
import { HdrParser } from './parser/texture/hdr.js';

const JSON_ADDRESS_MODE = {
    "repeat": ADDRESS_REPEAT,
    "clamp": ADDRESS_CLAMP_TO_EDGE,
    "mirror": ADDRESS_MIRRORED_REPEAT
};

const JSON_FILTER_MODE = {
    "nearest": FILTER_NEAREST,
    "linear": FILTER_LINEAR,
    "nearest_mip_nearest": FILTER_NEAREST_MIPMAP_NEAREST,
    "linear_mip_nearest": FILTER_LINEAR_MIPMAP_NEAREST,
    "nearest_mip_linear": FILTER_NEAREST_MIPMAP_LINEAR,
    "linear_mip_linear": FILTER_LINEAR_MIPMAP_LINEAR
};

const JSON_TEXTURE_TYPE = {
    "default": TEXTURETYPE_DEFAULT,
    "rgbm": TEXTURETYPE_RGBM,
    "rgbe": TEXTURETYPE_RGBE,
    "swizzleGGGR": TEXTURETYPE_SWIZZLEGGGR
};

/**
 * @interface
 * @name TextureParser
 * @description Interface to a texture parser. Implementations of this interface handle the loading
 * and opening of texture assets.
 */
class TextureParser {
    /**
     * @function
     * @name TextureParser#load
     * @description Load the texture from the remote URL. When loaded (or failed),
     * use the callback to return an the raw resource data (or error).
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {callbacks.ResourceHandler} callback - The callback used when the resource is loaded or an error occurs.
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
     */
    /* eslint-disable jsdoc/require-returns-check */
    load(url, callback, asset) {
        throw new Error('not implemented');
    }
    /* eslint-enable jsdoc/require-returns-check */

    /**
     * @function
     * @name TextureParser#open
     * @description Convert raw resource data into a resource instance. E.g. Take 3D model format JSON and return a {@link Model}.
     * @param {string} url - The URL of the resource to open.
     * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
     * @param {Asset|null} asset - Optional asset which is passed in by ResourceLoader.
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {Texture} The parsed resource data.
     */
    /* eslint-disable jsdoc/require-returns-check */
    open(url, data, device) {
        throw new Error('not implemented');
    }
    /* eslint-enable jsdoc/require-returns-check */
}

// In the case where a texture has more than 1 level of mip data specified, but not the full
// mip chain, we generate the missing levels here.
// This is to overcome an issue where iphone xr and xs ignores further updates to the mip data
// after invoking gl.generateMipmap on the texture (which was the previous method of ensuring
// the texture's full mip chain was complete).
// NOTE: this function only resamples RGBA8 and RGBAFloat32 data.
const _completePartialMipmapChain = function (texture) {

    const requiredMipLevels = Math.log2(Math.max(texture._width, texture._height)) + 1;

    const isHtmlElement = function (object) {
        return (object instanceof HTMLCanvasElement) ||
               (object instanceof HTMLImageElement) ||
               (object instanceof HTMLVideoElement);
    };

    if (!(texture._format === PIXELFORMAT_R8_G8_B8_A8 ||
          texture._format === PIXELFORMAT_RGBA32F) ||
          texture._volume ||
          texture._compressed ||
          texture._levels.length === 1 ||
          texture._levels.length === requiredMipLevels ||
          isHtmlElement(texture._cubemap ? texture._levels[0][0] : texture._levels[0])) {
        return;
    }

    const downsample = function (width, height, data) {
        const sampledWidth = Math.max(1, width >> 1);
        const sampledHeight = Math.max(1, height >> 1);
        const sampledData = new data.constructor(sampledWidth * sampledHeight * 4);

        const xs = Math.floor(width / sampledWidth);
        const ys = Math.floor(height / sampledHeight);
        const xsys = xs * ys;

        for (let y = 0; y < sampledHeight; ++y) {
            for (let x = 0; x < sampledWidth; ++x) {
                for (let e = 0; e < 4; ++e) {
                    let sum = 0;
                    for (let sy = 0; sy < ys; ++sy) {
                        for (let sx = 0; sx < xs; ++sx) {
                            sum += data[(x * xs + sx + (y * ys + sy) * width) * 4 + e];
                        }
                    }
                    sampledData[(x + y * sampledWidth) * 4 + e] = sum / xsys;
                }
            }
        }

        return sampledData;
    };

    // step through levels
    for (let level = texture._levels.length; level < requiredMipLevels; ++level) {
        const width = Math.max(1, texture._width >> (level - 1));
        const height = Math.max(1, texture._height >> (level - 1));
        if (texture._cubemap) {
            const mips = [];
            for (let face = 0; face < 6; ++face) {
                mips.push(downsample(width, height, texture._levels[level - 1][face]));
            }
            texture._levels.push(mips);
        } else {
            texture._levels.push(downsample(width, height, texture._levels[level - 1]));
        }
    }

    texture._levelsUpdated = texture._cubemap ? [[true, true, true, true, true, true]] : [true];
};

/**
 * @class
 * @name TextureHandler
 * @implements {ResourceHandler}
 * @classdesc Resource handler used for loading 2D and 3D {@link Texture} resources.
 * @param {GraphicsDevice} device - The graphics device.
 * @param {AssetRegistry} assets - The asset registry.
 * @param {ResourceLoader} loader - The resource loader.
 */
class TextureHandler {
    constructor(device, assets, loader) {
        this._device = device;
        this._assets = assets;
        this._loader = loader;

        // img parser handles all broswer-supported image formats, this
        // parser will be used when other more specific parsers are not found.
        this.imgParser = new ImgParser(assets);

        this.parsers = {
            dds: new LegacyDdsParser(assets),
            ktx: new KtxParser(assets),
            basis: new BasisParser(assets, device),
            hdr: new HdrParser(assets)
        };
    }

    get crossOrigin() {
        return this.imgParser.crossOrigin;
    }

    set crossOrigin(value) {
        this.imgParser.crossOrigin = value;
    }

    get maxRetries() {
        return this.imgParser.maxRetries;
    }

    set maxRetries(value) {
        this.imgParser.maxRetries = value;
        for (const parser in this.parsers) {
            if (this.parsers.hasOwnProperty(parser)) {
                this.parsers[parser].maxRetries = value;
            }
        }
    }

    _getUrlWithoutParams(url) {
        return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
    }

    _getParser(url) {
        const ext = path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '');
        return this.parsers[ext] || this.imgParser;
    }

    load(url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        this._getParser(url.original).load(url, callback, asset);
    }

    open(url, data, asset) {
        if (!url)
            return;

        let texture = this._getParser(url).open(url, data, this._device);

        if (texture === null) {
            texture = new Texture(this._device, {
                width: 4,
                height: 4,
                format: PIXELFORMAT_R8_G8_B8
            });
        } else {
            // check if the texture has only a partial mipmap chain specified and generate the
            // missing levels if possible.
            _completePartialMipmapChain(texture);

            // if the basis transcoder unswizzled a GGGR texture, remove the flag from the asset
            if (data.unswizzledGGGR) {
                asset.file.variants.basis.opt &= ~8;
            }
        }

        return texture;
    }

    patch(asset, assets) {
        const texture = asset.resource;
        if (!texture) {
            return;
        }

        if (asset.name && asset.name.length > 0) {
            texture.name = asset.name;
        }

        const assetData = asset.data;

        if (assetData.hasOwnProperty('minfilter')) {
            texture.minFilter = JSON_FILTER_MODE[assetData.minfilter];
        }

        if (assetData.hasOwnProperty('magfilter')) {
            texture.magFilter = JSON_FILTER_MODE[assetData.magfilter];
        }

        if (!texture.cubemap) {
            if (assetData.hasOwnProperty('addressu')) {
                texture.addressU = JSON_ADDRESS_MODE[assetData.addressu];
            }

            if (assetData.hasOwnProperty('addressv')) {
                texture.addressV = JSON_ADDRESS_MODE[assetData.addressv];
            }
        }

        if (assetData.hasOwnProperty('mipmaps')) {
            texture.mipmaps = assetData.mipmaps;
        }

        if (assetData.hasOwnProperty('anisotropy')) {
            texture.anisotropy = assetData.anisotropy;
        }

        if (assetData.hasOwnProperty('flipY')) {
            texture.flipY = !!assetData.flipY;
        }

        // extract asset type (this is bit of a mess)
        if (assetData.hasOwnProperty('type')) {
            texture.type = JSON_TEXTURE_TYPE[assetData.type];
        } else if (assetData.hasOwnProperty('rgbm') && assetData.rgbm) {
            texture.type = TEXTURETYPE_RGBM;
        } else if (asset.file && asset.getPreferredFile) {
            // basis normalmaps flag the variant as swizzled
            const preferredFile = asset.getPreferredFile();
            if (preferredFile) {
                if (preferredFile.opt && ((preferredFile.opt & 8) !== 0)) {
                    texture.type = TEXTURETYPE_SWIZZLEGGGR;
                }
            }
        }
    }
}

export { TextureHandler, TextureParser };
