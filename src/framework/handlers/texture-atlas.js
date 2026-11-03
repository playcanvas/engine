import { path } from '../../core/path.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec4 } from '../../core/math/vec4.js';
import {
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT,
    FILTER_LINEAR, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM
} from '../../platform/graphics/constants.js';
import { http } from '../../platform/net/http.js';
import { TextureAtlas } from '../../scene/texture-atlas.js';
import { Asset } from '../asset/asset.js';
import { ABSOLUTE_URL } from '../asset/constants.js';
import { isSpriteSheet, parseSpriteSheet } from '../parsers/sprite-sheet.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

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

const regexFrame = /^data\.frames\.(\d+)$/;

// resolves the url of a file named by a json file, relative to the url the json loaded from
const resolveUrl = (url, name) => {
    if (ABSOLUTE_URL.test(name) || name.startsWith('blob:') || name.startsWith('data:')) {
        return name;
    }

    // a json file loaded from a blob url, such as from a bundle, has its location in the original
    const blob = url.load.startsWith('blob:') || url.load.startsWith('data:');
    const base = blob ? url.original : url.load;
    return path.join(path.getDirectory(base.split('?')[0]), name);
};

/**
 * Resource handler for the `textureatlas` asset type. Loads a texture and its frame definitions
 * into a {@link TextureAtlas}. The frames come from the asset data, or from a JSON file.
 *
 * The JSON file can be a sprite sheet exported by TexturePacker or Aseprite as JSON, with its
 * frames as a hash or an array. Each frame is keyed by its name, and the image named by
 * `meta.image` loads from beside the JSON file. A trimmed frame keeps the position it had in its
 * untrimmed sprite. Rotated frames are not supported, so export the sheet with rotation disabled.
 * The JSON file can also hold texture atlas frames, with a PNG image of the same name beside it.
 *
 * The image of a JSON file is created with the texture settings in the asset data, such as
 * `srgb` and `minfilter`, as the image of a texture asset is.
 *
 * @example
 * // a pixel art sprite sheet exported by Aseprite, with frames named "walk 0" to "walk 3"
 * const asset = new Asset('walk', 'textureatlas', { url: 'sprites/walk.json' }, {
 *     minfilter: 'nearest',
 *     magfilter: 'nearest',
 *     srgb: true
 * });
 * asset.ready(() => {
 *     const sprite = new Sprite(app.graphicsDevice, {
 *         atlas: asset.resource,
 *         frameKeys: ['walk 0', 'walk 1', 'walk 2', 'walk 3'],
 *         pixelsPerUnit: 32
 *     });
 * });
 * app.assets.add(asset);
 * app.assets.load(asset);
 *
 * @category Asset
 */
class TextureAtlasHandler extends ResourceHandler {
    /**
     * Create a new TextureAtlasHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'textureatlas');

        this._loader = app.loader;
    }

    // Load the texture atlas texture using the texture resource loader
    load(url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        const handler = this._loader.getHandler('texture');

        // if supplied with a json file url (probably engine-only), load the json data, then the
        // image it names, or a png of the same name
        if (path.getExtension(url.original) === '.json') {
            http.get(url.load, {
                retry: this.maxRetries > 0,
                maxRetries: this.maxRetries
            }, (err, response) => {
                if (err) {
                    callback(err);
                    return;
                }

                const spriteSheet = isSpriteSheet(response);
                const image = (spriteSheet && response.meta?.image) ||
                    path.getBasename(url.original.split('?')[0]).replace(/\.json$/i, '.png');
                const textureUrl = resolveUrl(url, image);

                // the texture is created with the atlas asset's texture options, such as srgb
                const textureAsset = asset && new Asset(asset.name, 'texture', { url: textureUrl },
                    asset.data, asset.options);

                this._loader.load(textureUrl, 'texture', (err, texture) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    // the atlas destroys its texture when it unloads, so the texture must not
                    // stay in the cache for a later load to find
                    this._loader.clearCache(textureUrl, 'texture');

                    let data = response;
                    if (spriteSheet) {
                        try {
                            const { width, height } = texture;
                            data = { frames: parseSpriteSheet(response, width, height) };
                        } catch (e) {
                            texture.destroy();
                            callback(`Error loading sprite sheet ${url.original}: ${e.message}`);
                            return;
                        }
                    }

                    callback(null, {
                        data: data,
                        texture: texture
                    });
                }, textureAsset);
            });
        } else {
            handler.load(url, callback);
        }
    }

    // Create texture atlas resource using the texture from the texture loader
    open(url, data, asset) {
        const resource = new TextureAtlas();
        if (data.texture && data.data) {
            resource.texture = data.texture;
            resource.__data = data.data; // store data temporarily to be copied into asset
        } else {
            const handler = this._loader.getHandler('texture');
            const texture = handler.open(url, data, asset);
            if (!texture) return null;
            resource.texture = texture;
        }
        return resource;
    }

    patch(asset, assets) {
        // during editor update the underlying texture is temporarily null. just return in that case.
        if (!asset.resource) {
            return;
        }

        if (asset.resource.__data) {
            // engine-only, so copy temporary asset data from texture atlas into asset and delete temp property
            if (asset.resource.__data.minfilter !== undefined) asset.data.minfilter = asset.resource.__data.minfilter;
            if (asset.resource.__data.magfilter !== undefined) asset.data.magfilter = asset.resource.__data.magfilter;
            if (asset.resource.__data.addressu !== undefined) asset.data.addressu = asset.resource.__data.addressu;
            if (asset.resource.__data.addressv !== undefined) asset.data.addressv = asset.resource.__data.addressv;
            if (asset.resource.__data.mipmaps !== undefined) asset.data.mipmaps = asset.resource.__data.mipmaps;
            if (asset.resource.__data.anisotropy !== undefined) asset.data.anisotropy = asset.resource.__data.anisotropy;
            if (asset.resource.__data.rgbm !== undefined) asset.data.rgbm = !!asset.resource.__data.rgbm;

            asset.data.frames = asset.resource.__data.frames;

            delete asset.resource.__data;
        }

        // pass texture data
        const texture = asset.resource.texture;
        if (texture) {
            texture.name = asset.name;

            if (asset.data.hasOwnProperty('minfilter') && texture.minFilter !== JSON_FILTER_MODE[asset.data.minfilter]) {
                texture.minFilter = JSON_FILTER_MODE[asset.data.minfilter];
            }

            if (asset.data.hasOwnProperty('magfilter') && texture.magFilter !== JSON_FILTER_MODE[asset.data.magfilter]) {
                texture.magFilter = JSON_FILTER_MODE[asset.data.magfilter];
            }

            if (asset.data.hasOwnProperty('addressu') && texture.addressU !== JSON_ADDRESS_MODE[asset.data.addressu]) {
                texture.addressU = JSON_ADDRESS_MODE[asset.data.addressu];
            }

            if (asset.data.hasOwnProperty('addressv') && texture.addressV !== JSON_ADDRESS_MODE[asset.data.addressv]) {
                texture.addressV = JSON_ADDRESS_MODE[asset.data.addressv];
            }

            if (asset.data.hasOwnProperty('mipmaps') && texture.mipmaps !== asset.data.mipmaps) {
                texture.mipmaps = asset.data.mipmaps;
            }

            if (asset.data.hasOwnProperty('anisotropy') && texture.anisotropy !== asset.data.anisotropy) {
                texture.anisotropy = asset.data.anisotropy;
            }

            if (asset.data.hasOwnProperty('rgbm')) {
                const type = asset.data.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
                if (texture.type !== type) {
                    texture.type = type;
                }
            }
        }

        asset.resource.texture = texture;

        // set frames
        const frames = {};
        for (const key in asset.data.frames) {
            const frame = asset.data.frames[key];
            frames[key] = {
                rect: new Vec4(frame.rect),
                pivot: new Vec2(frame.pivot),
                border: new Vec4(frame.border)
            };
        }
        asset.resource.frames = frames;

        asset.off('change', this._onAssetChange, this);
        asset.on('change', this._onAssetChange, this);
    }

    _onAssetChange(asset, attribute, value) {
        let frame;

        if (attribute === 'data' || attribute === 'data.frames') {
            // set frames
            const frames = {};
            for (const key in value.frames) {
                frame = value.frames[key];
                frames[key] = {
                    rect: new Vec4(frame.rect),
                    pivot: new Vec2(frame.pivot),
                    border: new Vec4(frame.border)
                };
            }
            asset.resource.frames = frames;
        } else {
            const match = attribute.match(regexFrame);
            if (match) {
                const frameKey = match[1];

                if (value) {
                    // add or update frame
                    if (!asset.resource.frames[frameKey]) {
                        asset.resource.frames[frameKey] = {
                            rect: new Vec4(value.rect),
                            pivot: new Vec2(value.pivot),
                            border: new Vec4(value.border)
                        };
                    } else {
                        frame = asset.resource.frames[frameKey];
                        frame.rect.set(value.rect[0], value.rect[1], value.rect[2], value.rect[3]);
                        frame.pivot.set(value.pivot[0], value.pivot[1]);
                        frame.border.set(value.border[0], value.border[1], value.border[2], value.border[3]);
                    }

                    asset.resource.fire('set:frame', frameKey, asset.resource.frames[frameKey]);

                } else {
                    // delete frame
                    if (asset.resource.frames[frameKey]) {
                        delete asset.resource.frames[frameKey];
                        asset.resource.fire('remove:frame', frameKey);
                    }
                }

            }
        }
    }
}

export { TextureAtlasHandler };
