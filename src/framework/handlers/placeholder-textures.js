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

const ENCODERS = {
    [TEXTURETYPE_RGBM]: encodeRGBM,
    [TEXTURETYPE_RGBP]: encodeRGBP,
    [TEXTURETYPE_RGBE]: encodeRGBE
};

/**
 * Returns the texel of a placeholder texture of the given type, which shows the color the texel of
 * the default type shows when a shader decodes it from gamma space, as the color textures a
 * texture of an encoded type stands in for are.
 *
 * @param {string} color - The name of the color.
 * @param {string} type - The type of the texture.
 * @returns {number[]} The four channels of the texel, in the range 0..255.
 */
const getTexel = (color, type) => {
    const texel = COLORS[color];

    // a swizzled normal map stores the x and y of the normal in the alpha and green channels
    if (type === TEXTURETYPE_SWIZZLEGGGR && color === 'normal') {
        return [128, 128, 128, 128];
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
 * Each texture parameter has placeholders of its own, as a material samples maps holding the same
 * texture from one sampler.
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
     * Returns the placeholder of a texture parameter, created on the first request.
     *
     * @param {string} parameterName - The name of the texture parameter, such as 'diffuseMap'.
     * @param {boolean} srgb - Whether the texture it stands in for is sRGB.
     * @param {string} type - The type of the texture it stands in for.
     * @returns {Texture} The placeholder texture.
     */
    get(parameterName, srgb, type) {
        const name = `placeholder-${parameterName}-${srgb ? 'srgb' : 'linear'}-${type}`;
        let texture = this._textures.get(name);
        if (!texture) {
            const color = PLACEHOLDER_MAP[parameterName];
            Debug.assert(color, `No placeholder texture found for parameter: ${parameterName}`);

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
                levels: [new Uint8Array(getTexel(color ?? 'gray', type))]
            });

            this._textures.set(name, texture);
            this._set.add(texture);
        }
        return texture;
    }
}

export { PlaceholderTextures };
