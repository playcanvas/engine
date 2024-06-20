import { path } from '../../core/path.js';

import {
    TEXHINT_ASSET,
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT,
    FILTER_LINEAR, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR,
    PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTURETYPE_RGBP
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { TextureUtils } from '../../platform/graphics/texture-utils.js';

import { BasisParser } from '../parsers/texture/basis.js';
import { ImgParser } from '../parsers/texture/img.js';
import { KtxParser } from '../parsers/texture/ktx.js';
import { Ktx2Parser } from '../parsers/texture/ktx2.js';
import { DdsParser } from '../parsers/texture/dds.js';
import { HdrParser } from '../parsers/texture/hdr.js';

import { ResourceHandler } from './handler.js';

const JSON_ADDRESS_MODE = {
    'repeat': ADDRESS_REPEAT,
    'clamp': ADDRESS_CLAMP_TO_EDGE,
    'mirror': ADDRESS_MIRRORED_REPEAT
};

const JSON_FILTER_MODE = {
    'nearest': FILTER_NEAREST,
    'linear': FILTER_LINEAR,
    'nearest_mip_nearest': FILTER_NEAREST_MIPMAP_NEAREST,
    'linear_mip_nearest': FILTER_LINEAR_MIPMAP_NEAREST,
    'nearest_mip_linear': FILTER_NEAREST_MIPMAP_LINEAR,
    'linear_mip_linear': FILTER_LINEAR_MIPMAP_LINEAR
};

const JSON_TEXTURE_TYPE = {
    'default': TEXTURETYPE_DEFAULT,
    'rgbm': TEXTURETYPE_RGBM,
    'rgbe': TEXTURETYPE_RGBE,
    'rgbp': TEXTURETYPE_RGBP,
    'swizzleGGGR': TEXTURETYPE_SWIZZLEGGGR
};

// In the case where a texture has more than 1 level of mip data specified, but not the full
// mip chain, we generate the missing levels here.
// This is to overcome an issue where iphone xr and xs ignores further updates to the mip data
// after invoking gl.generateMipmap on the texture (which was the previous method of ensuring
// the texture's full mip chain was complete).
// NOTE: this function only resamples RGBA8 and RGBAFloat32 data.
const _completePartialMipmapChain = function (texture) {

    const requiredMipLevels = TextureUtils.calcMipLevelsCount(texture._width, texture._height);

    const isHtmlElement = function (object) {
        return (object instanceof HTMLCanvasElement) ||
               (object instanceof HTMLImageElement) ||
               (object instanceof HTMLVideoElement);
    };

    if (!(texture._format === PIXELFORMAT_RGBA8 ||
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
 * Resource handler used for loading 2D and 3D {@link Texture} resources.
 *
 * @category Graphics
 */
class TextureHandler extends ResourceHandler {
    /**
     * Create a new TextureHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'texture');

        const assets = app.assets;
        const device = app.graphicsDevice;

        this._device = device;
        this._assets = assets;

        // img parser handles all browser-supported image formats, this
        // parser will be used when other more specific parsers are not found.
        this.imgParser = new ImgParser(assets, device);

        this.parsers = {
            dds: new DdsParser(assets),
            ktx: new KtxParser(assets),
            ktx2: new Ktx2Parser(assets, device),
            basis: new BasisParser(assets, device),
            hdr: new HdrParser(assets)
        };
    }

    set crossOrigin(value) {
        this.imgParser.crossOrigin = value;
    }

    get crossOrigin() {
        return this.imgParser.crossOrigin;
    }

    set maxRetries(value) {
        this.imgParser.maxRetries = value;
        for (const parser in this.parsers) {
            if (this.parsers.hasOwnProperty(parser)) {
                this.parsers[parser].maxRetries = value;
            }
        }
    }

    get maxRetries() {
        return this.imgParser.maxRetries;
    }

    _getUrlWithoutParams(url) {
        return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
    }

    _getParser(url) {
        const ext = path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '');
        return this.parsers[ext] || this.imgParser;
    }

    _getTextureOptions(asset) {

        const options = {
            // #if _PROFILER
            profilerHint: TEXHINT_ASSET
            // #endif
        };

        if (asset) {
            if (asset.name?.length > 0) {
                options.name = asset.name;
            }

            const assetData = asset.data;

            if (assetData.hasOwnProperty('minfilter')) {
                options.minFilter = JSON_FILTER_MODE[assetData.minfilter];
            }

            if (assetData.hasOwnProperty('magfilter')) {
                options.magFilter = JSON_FILTER_MODE[assetData.magfilter];
            }

            if (assetData.hasOwnProperty('addressu')) {
                options.addressU = JSON_ADDRESS_MODE[assetData.addressu];
            }

            if (assetData.hasOwnProperty('addressv')) {
                options.addressV = JSON_ADDRESS_MODE[assetData.addressv];
            }

            if (assetData.hasOwnProperty('mipmaps')) {
                options.mipmaps = assetData.mipmaps;
            }

            if (assetData.hasOwnProperty('anisotropy')) {
                options.anisotropy = assetData.anisotropy;
            }

            if (assetData.hasOwnProperty('flipY')) {
                options.flipY = !!assetData.flipY;
            }

            if (assetData.hasOwnProperty('srgb')) {
                options.srgb = !!assetData.srgb;
            }

            // extract asset type (this is bit of a mess)
            if (assetData.hasOwnProperty('type')) {
                options.type = JSON_TEXTURE_TYPE[assetData.type];
            } else if (assetData.hasOwnProperty('rgbm') && assetData.rgbm) {
                options.type = TEXTURETYPE_RGBM;
            } else if (asset.file && (asset.file.opt & 8) !== 0) {
                // basis normalmaps flag the variant as swizzled
                options.type = TEXTURETYPE_SWIZZLEGGGR;
            }
        }

        return options;
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
            return undefined;

        const textureOptions = this._getTextureOptions(asset);
        let texture = this._getParser(url).open(url, data, this._device, textureOptions);

        if (texture === null) {
            texture = new Texture(this._device, {
                width: 4,
                height: 4,
                format: PIXELFORMAT_RGB8
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

        // apply asset options, based on asset.data
        const options = this._getTextureOptions(asset);
        for (const key of Object.keys(options)) {
            texture[key] = options[key];
        }
    }
}

export { TextureHandler };
