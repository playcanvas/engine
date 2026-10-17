import { Debug } from '../../core/debug.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA8,
    TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

// the color of the placeholder of each texture parameter of a standard material
const PLACEHOLDER_MAP = {
    aoMap: 'white',
    aoDetailMap: 'white',
    diffuseMap: 'gray',
    diffuseDetailMap: 'gray',
    specularMap: 'gray',
    specularityFactorMap: 'white',
    metalnessMap: 'black',
    glossMap: 'gray',
    sheenMap: 'black',
    sheenGlossMap: 'gray',
    diffuseTransmissionMap: 'white',
    diffuseTransmissionColorMap: 'white',
    clearCoatMap: 'black',
    clearCoatGlossMap: 'gray',
    clearCoatNormalMap: 'normal',
    refractionMap: 'white',
    emissiveMap: 'gray',
    normalMap: 'normal',
    normalDetailMap: 'normal',
    heightMap: 'gray',
    opacityMap: 'gray',
    sphereMap: 'gray',
    lightMap: 'white',
    thicknessMap: 'black',
    iridescenceMap: 'black',
    iridescenceThicknessMap: 'black',
    envAtlas: 'black',
    anisotropyMap: 'black'
};

// the texture parameters a shader samples as a color, decoding it by the encoding of the texture,
// where the other parameters use the sampled value as it is
const COLOR_PARAMETERS = new Set([
    'diffuseMap', 'diffuseDetailMap', 'emissiveMap', 'lightMap', 'specularMap', 'sheenMap',
    'sphereMap', 'envAtlas', 'diffuseTransmissionColorMap'
]);

// the texel of each color, in a texture of the default type
const COLORS = {
    white: [255, 255, 255, 255],
    gray: [128, 128, 128, 255],
    black: [0, 0, 0, 255],
    normal: [128, 128, 255, 255]
};

// the channels of a texel as the encodings of the texture types store them, the same as the encode
// functions of the shader chunks
const encodeRGBM = (linear) => {
    const rgb = linear.map(c => Math.sqrt(c) / 8);
    const a = Math.ceil(Math.min(1, Math.max(...rgb, 1 / 255)) * 255) / 255;
    return [...rgb.map(c => c / a), a];
};

const encodeRGBP = (linear) => {
    const gamma = linear.map(c => Math.sqrt(c));
    const maxVal = Math.min(8, Math.max(1, ...gamma));
    const v = Math.ceil((1 - (maxVal - 1) / 7) * 255) / 255;
    return [...gamma.map(c => c / (8 - 7 * v)), v];
};

const encodeRGBE = (linear) => {
    const maxVal = Math.max(...linear);
    if (maxVal < 1e-32) {
        return [0, 0, 0, 0];
    }
    const e = Math.ceil(Math.log2(maxVal));
    return [...linear.map(c => c / Math.pow(2, e)), (e + 128) / 255];
};

// a linear value in the range 0..1 as an sRGB texture stores it, which sampling decodes
const linearToSrgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

const ENCODERS = {
    [TEXTURETYPE_RGBM]: encodeRGBM,
    [TEXTURETYPE_RGBP]: encodeRGBP,
    [TEXTURETYPE_RGBE]: encodeRGBE
};

// a tangent space normal pointing straight out of the surface, as a swizzled normal map stores it:
// its x and y in the alpha and green channels
const SWIZZLED_NORMAL = [128, 128, 128, 128];

const CHANNELS = 'rgba';

/**
 * A texture parameter a placeholder stands in for, with the channels of the texture it samples.
 *
 * @typedef {object} PlaceholderMap
 * @property {string} name - The name of the texture parameter, such as 'aoMap'.
 * @property {string} [channel] - The channels the parameter samples, such as 'g', or all of them
 * when not specified.
 * @ignore
 */

/**
 * Returns the texel of a placeholder texture which stands in for one texture referenced by the
 * given texture parameters. Each parameter shows its color in the channels it samples, so a
 * texture packing several maps into its channels shows the color of each. Where two parameters
 * sample the same channel, one value serves both, as it does once the texture loads, and the lower
 * value wins: a channel sampled by the metalness and the ambient occlusion maps is black, for no
 * metalness, rather than white, for no occlusion. Channels no parameter samples show the color of
 * the first parameter.
 *
 * Sampling an sRGB texture decodes its color channels, so the channels of an sRGB placeholder a
 * parameter uses as a value rather than a color store the value gamma encoded, to sample the value
 * the texel of the default type holds. A texel of an encoded type shows the color the texel of the
 * default type shows when a shader decodes it from gamma space, as the color textures a texture of
 * an encoded type stands in for are.
 *
 * @param {PlaceholderMap[]} maps - The texture parameters.
 * @param {boolean} srgb - Whether the texture is sRGB.
 * @param {string} type - The type of the texture.
 * @returns {number[]} The four channels of the texel, in the range 0..255.
 */
const getTexel = (maps, srgb, type) => {
    const texelOf = (name) => {
        const color = PLACEHOLDER_MAP[name];
        Debug.assert(color, `No placeholder texture found for parameter: ${name}`);
        const texel = type === TEXTURETYPE_SWIZZLEGGGR && color === 'normal' ? SWIZZLED_NORMAL : COLORS[color ?? 'gray'];
        if (srgb && !ENCODERS[type] && !COLOR_PARAMETERS.has(name)) {
            return [...texel.slice(0, 3).map(c => Math.round(linearToSrgb(c / 255) * 255)), texel[3]];
        }
        return texel;
    };

    const texel = texelOf(maps[0].name).slice();
    const sampled = [false, false, false, false];
    for (const { name, channel } of maps) {
        const mapTexel = texelOf(name);
        for (const c of channel || CHANNELS) {
            const i = CHANNELS.indexOf(c);
            texel[i] = sampled[i] ? Math.min(texel[i], mapTexel[i]) : mapTexel[i];
            sampled[i] = true;
        }
    }

    const encode = ENCODERS[type];
    if (encode) {
        const linear = texel.slice(0, 3).map(c => Math.pow(c / 255, 2.2));
        return encode(linear).map(c => Math.round(Math.min(1, c) * 255));
    }

    return texel;
};

/**
 * The 1x1 textures the {@link MaterialHandler} assigns to a texture parameter of a material while
 * its texture asset loads, which the loaded texture then replaces.
 *
 * A placeholder decodes like the texture it stands in for, as it is sRGB and of the type that
 * texture is, so the shader generated for the placeholder is the one the texture needs as well.
 * A placeholder is named after the first of the texture parameters it stands in for, and
 * placeholders named after different parameters are different textures, as a material samples
 * maps holding the same texture from one sampler.
 *
 * The textures are created the first time they are needed, which is when an asset is bound to a
 * material or unloads - never while rendering, where creating a texture is not supported.
 *
 * @ignore
 */
class PlaceholderTextures {
    /**
     * The graphics device the textures are created on.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * The placeholder textures, by their name.
     *
     * @type {Map<string, Texture>}
     * @private
     */
    _textures = new Map();

    /**
     * The placeholder textures, to recognize one.
     *
     * @type {Set<Texture>}
     * @private
     */
    _set = new Set();

    /**
     * @param {GraphicsDevice} device - The graphics device the textures are created on, and
     * destroyed with.
     */
    constructor(device) {
        this.device = device;
        device.on('destroy', this.destroy, this);
    }

    destroy() {
        this.device.off('destroy', this.destroy, this);
        this._textures.forEach(texture => texture.destroy());
        this._textures.clear();
        this._set.clear();
    }

    /**
     * Returns whether a texture is one of the placeholders.
     *
     * @param {Texture|null|undefined} texture - The texture.
     * @returns {boolean} True if the texture is a placeholder.
     */
    has(texture) {
        return this._set.has(texture);
    }

    /**
     * Returns the placeholder standing in for one texture referenced by the given texture
     * parameters of a material, created on the first request.
     *
     * @param {PlaceholderMap[]} maps - The texture parameters referencing the texture, the first
     * of which names the placeholder.
     * @param {boolean} srgb - Whether the texture it stands in for is sRGB.
     * @param {string} type - The type of the texture it stands in for.
     * @returns {Texture} The placeholder texture.
     */
    get(maps, srgb, type) {
        const texel = getTexel(maps, srgb, type);
        const hex = texel.map(c => c.toString(16).padStart(2, '0')).join('');
        const name = `placeholder-${maps[0].name}-${srgb ? 'srgb' : 'linear'}-${type}-${hex}`;
        let texture = this._textures.get(name);
        if (!texture) {
            texture = new Texture(this.device, {
                name,
                width: 1,
                height: 1,
                format: PIXELFORMAT_RGBA8,
                srgb,
                type,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE,
                levels: [new Uint8Array(texel)]
            });

            this._textures.set(name, texture);
            this._set.add(texture);
        }
        return texture;
    }
}

export { PlaceholderTextures };
