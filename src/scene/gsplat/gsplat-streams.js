import { Vec2 } from '../../core/math/vec2.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatFormat } from './gsplat-format.js'
 */

/**
 * Manages textures for a GSplatFormat, creating them from stream definitions.
 *
 * @ignore
 */
class GSplatStreams {
    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * The format defining the streams.
     *
     * @type {GSplatFormat|null}
     */
    format = null;

    /**
     * Map of texture names to Texture instances.
     *
     * @type {Map<string, Texture>}
     */
    textures = new Map();

    /**
     * Texture dimensions (width and height).
     *
     * @type {Vec2}
     * @private
     */
    _textureDimensions = new Vec2();

    /**
     * Gets the texture dimensions (width and height).
     *
     * @type {Vec2}
     */
    get textureDimensions() {
        return this._textureDimensions;
    }

    /**
     * Creates a new GSplatStreams instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        this.device = device;
    }

    /**
     * Destroys all managed textures.
     */
    destroy() {
        for (const texture of this.textures.values()) {
            texture.destroy();
        }
        this.textures.clear();
    }

    /**
     * Initialize with format and create textures for all streams.
     *
     * @param {GSplatFormat} format - The format defining streams.
     * @param {number} numElements - Number of elements (splats) to size textures for.
     */
    init(format, numElements) {
        this.format = format;
        this._textureDimensions = this.evalTextureSize(numElements);

        // Create textures for all streams
        for (const stream of format.streams) {
            const texture = this.createTexture(stream.name, stream.format, this._textureDimensions);
            this.textures.set(stream.name, texture);
        }
    }

    /**
     * Gets a texture by name.
     *
     * @param {string} name - Texture name.
     * @returns {Texture|undefined} The texture, or undefined if not found.
     */
    getTexture(name) {
        return this.textures.get(name);
    }

    /**
     * Evaluates the texture size needed to store a given number of elements.
     *
     * @param {number} count - The number of elements to store.
     * @returns {Vec2} The width and height of the texture.
     */
    evalTextureSize(count) {
        const width = Math.ceil(Math.sqrt(count));
        return new Vec2(width, Math.ceil(count / width));
    }

    /**
     * Creates a new texture with the specified parameters.
     *
     * @param {string} name - The name of the texture to be created.
     * @param {number} format - The pixel format of the texture.
     * @param {Vec2} size - The size of the texture in a Vec2 object, containing width (x) and height (y).
     * @param {Uint8Array|Uint16Array|Uint32Array} [data] - The initial data to fill the texture with.
     * @returns {Texture} The created texture instance.
     */
    createTexture(name, format, size, data) {
        return new Texture(this.device, {
            name: name,
            width: size.x,
            height: size.y,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            ...(data ? { levels: [data] } : { })
        });
    }
}

export { GSplatStreams };
