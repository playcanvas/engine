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

    /**
     * @interface
     * @name pc.TextureParser
     * @description Interface to a texture parser. Implementations of this interface handle the loading
     * and opening of texture assets.
     */
    var TextureParser = function () { };

    Object.assign(TextureParser.prototype, {
         /**
         * @function
         * @name pc.TextureParser#load
         * @description Load the texture from the remote URL. When loaded (or failed),
         * use the callback to return an the raw resource data (or error).
         * @param {object} url - The URL of the resource to load.
         * @param {string} url.load - The URL to use for loading the resource
         * @param {string} url.original - The original URL useful for identifying the resource type
         * @param {pc.callbacks.ResourceHandler} callback - The callback used when the resource is loaded or an error occurs.
         * @param {pc.Asset} [asset] - Optional asset that is passed by ResourceLoader.
         */
        load: function (url, callback, asset) {
            throw new Error('not implemented');
        },

        /**
         * @function
         * @name pc.TextureParser#open
         * @description Convert raw resource data into a resource instance. E.g. Take 3D model format JSON and return a pc.Model.
         * @param {string} url - The URL of the resource to open.
         * @param {*} data - The raw resource data passed by callback from {@link pc.ResourceHandler#load}.
         * @param {pc.Asset} [asset] - Optional asset that is passed by ResourceLoader.
         * @returns {pc.Texture} The parsed resource data.
         */
        open: function (url, data, device) {
            throw new Error('not implemented');
        }
    });

    // In the case where a texture has more than 1 level of mip data specified, but not the full
    // mip chain, we generate the missing levels here.
    // This is to overcome an issue where iphone xr and xs ignores further updates to the mip data
    // after invoking gl.generateMipmap on the texture (which was the previous method of ensuring
    // the texture's full mip chain was complete).
    // NOTE: this function only resamples RGBA8 and RGBAFloat32 data.
    var _completePartialMipmapChain = function (texture) {

        var requiredMipLevels = Math.log2(Math.max(texture._width, texture._height)) + 1;

        var isHtmlElement = function (object) {
            return (object instanceof HTMLCanvasElement) ||
                   (object instanceof HTMLImageElement) ||
                   (object instanceof HTMLVideoElement);
        };

        if (!(texture._format === pc.PIXELFORMAT_R8_G8_B8_A8 ||
              texture._format === pc.PIXELFORMAT_RGBA32F) ||
              texture._volume ||
              texture._compressed ||
              texture._levels.length === 1 ||
              texture._levels.length === requiredMipLevels ||
              isHtmlElement(texture._cubemap ? texture._levels[0][0] : texture._levels[0])) {
            return;
        }

        var downsample = function (width, height, data) {
            var sampledWidth = Math.max(1, width >> 1);
            var sampledHeight = Math.max(1, height >> 1);
            var sampledData = new data.constructor(sampledWidth * sampledHeight * 4);

            var xs = Math.floor(width / sampledWidth);
            var ys = Math.floor(height / sampledHeight);
            var xsys = xs * ys;

            for (var y = 0; y < sampledHeight; ++y) {
                for (var x = 0; x < sampledWidth; ++x) {
                    for (var e = 0; e < 4; ++e) {
                        var sum = 0;
                        for (var sy = 0; sy < ys; ++sy) {
                            for (var sx = 0; sx < xs; ++sx) {
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
        for (var level = texture._levels.length; level < requiredMipLevels; ++level) {
            var width = Math.max(1, texture._width >> (level - 1));
            var height = Math.max(1, texture._height >> (level - 1));
            if (texture._cubemap) {
                var mips = [];
                for (var face = 0; face < 6; ++face) {
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
     * @name pc.TextureHandler
     * @implements {pc.ResourceHandler}
     * @classdesc Resource handler used for loading 2D and 3D {@link pc.Texture} resources.
     * @param {pc.GraphicsDevice} device - The graphics device.
     * @param {pc.AssetRegistry} assets - The asset registry.
     * @param {pc.ResourceLoader} loader - The resource loader.
     */
    var TextureHandler = function (device, assets, loader) {
        this._device = device;
        this._assets = assets;
        this._loader = loader;

        var imgParser = new pc.ImgParser(assets, false);

        this.parsers = {
            dds: new pc.LegacyDdsParser(assets, false),
            ktx: new pc.KtxParser(assets, false),
            basis: new pc.BasisParser(assets, false),
            jpg: imgParser,
            jpeg: imgParser,
            gif: imgParser,
            png: imgParser,
            blob: imgParser
        };
    };

    Object.assign(TextureHandler.prototype, {
        _getParser: function (url) {
            var ext = pc.path.getExtension(url).toLowerCase().replace('.', '');
            return this.parsers[ext];
        },

        load: function (url, callback, asset) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var urlWithoutParams = url.original.indexOf('?') >= 0 ? url.original.split('?')[0] : url.original;
            var parser = this._getParser(urlWithoutParams);

            // if we can't find a parser by url extension, check if it's a blob url
            if (!parser) {
                var blobStart = urlWithoutParams.indexOf("blob:");
                if (blobStart >= 0) {
                    url = urlWithoutParams.substr(blobStart);
                    parser = this.parsers.img;
                }
            }

            if (parser) {
                parser.load(url, callback, asset);
            } else {
                // Unsupported texture extension
                // Use timeout because asset events can be hooked up after load gets called in some
                // cases. For example, material loads a texture on 'add' event.
                setTimeout(function () {
                    callback(pc.string.format("Error loading Texture: format not supported: '{0}'", pc.path.getExtension(urlWithoutParams).toLowerCase()));
                }, 0);
            }
        },

        open: function (url, data) {
            if (!url)
                return;

            var urlWithoutParams = url.indexOf('?') >= 0 ? url.split('?')[0] : url;
            var parser = this._getParser(urlWithoutParams);
            var texture = parser ? parser.open(url, data, this._device) : null;

            if (texture === null) {
                texture = new pc.Texture(this._device, {
                    name: 'unsupported-empty',
                    width: 4,
                    height: 4,
                    format: pc.PIXELFORMAT_R8_G8_B8
                });
            } else {
                // check if the texture has only a partial mipmap chain specified and generate the
                // missing levels if possible.
                _completePartialMipmapChain(texture);
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

            if (asset.file && asset.getPreferredFile) {
                var preferredFile = asset.getPreferredFile();
                if (preferredFile) {
                    if (preferredFile.opt && ((preferredFile.opt & 8) !== 0)) {
                        texture.swizzleGGGR = true;
                    }
                }
            }
        },

        /**
         * @function
         * @name pc.TextureHandler#addParser
         * @description Add a texture parsers 
         * @param {string} extension - The file extension handled by this parser.
         * @param {pc.TextureParser} parser - The texture parser.
         */
        addParser: function (extension, parser) {
            this.parsers[extension] = parser;
        }
    });

    return {
        TextureHandler: TextureHandler,
        TextureParser: TextureParser
    };
}());
