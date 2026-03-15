import { Vec2 } from '../../core/math/vec2.js';
import { Texture } from '../../platform/graphics/texture.js';
import { TextureUtils } from '../../platform/graphics/texture-utils.js';

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
     * Whether this manages instance-level textures (true) or resource-level textures (false).
     *
     * @type {boolean}
     * @private
     */
    _isInstance = false;

    /**
     * The format version at last sync.
     *
     * @type {number}
     * @private
     */
    _formatVersion = -1;

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
     * @param {boolean} [isInstance] - Whether this manages instance-level textures (true) or
     * resource-level textures (false). Defaults to false.
     */
    constructor(device, isInstance = false) {
        this.device = device;
        this._isInstance = isInstance;
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
        this._textureDimensions = TextureUtils.calcTextureSize(numElements, new Vec2());

        // Create textures for all streams (base + extra, filtered by _isInstance)
        const streams = this._isInstance ? format.instanceStreams : format.resourceStreams;
        for (const stream of streams) {
            const texture = this.createTexture(stream.name, stream.format, this._textureDimensions);
            this.textures.set(stream.name, texture);
        }

        // Mark as synced with current version
        this._formatVersion = format.extraStreamsVersion;
    }

    /**
     * Gets a texture by name.
     *
     * @param {string} name - Texture name.
     * @returns {Texture|undefined} The texture, or undefined if not found.
     */
    getTexture(name) {
        // Creates textures if format was modified since last sync
        this.syncWithFormat(this.format);
        return this.textures.get(name);
    }

    /**
     * Gets all textures in format order (streams followed by extraStreams).
     *
     * @returns {Texture[]} Array of textures in format order.
     * @ignore
     */
    getTexturesInOrder() {
        const result = [];
        if (this.format) {
            const allStreams = this._isInstance ? this.format.instanceStreams : this.format.resourceStreams;
            for (const stream of allStreams) {
                const texture = this.textures.get(stream.name);
                if (texture) {
                    result.push(texture);
                }
            }
        }
        return result;
    }

    /**
     * Synchronizes textures with the format's stream definitions.
     * Creates new textures for added streams. Textures are never destroyed here -
     * streams can only be added, not removed (see GSplatFormat._extraStreams for rationale).
     *
     * @param {GSplatFormat|null} format - The format to sync with, or null to skip.
     * @ignore
     */
    syncWithFormat(format) {
        if (format) {
            // Only skip if same format AND version matches
            if (this.format === format && this._formatVersion === format.extraStreamsVersion) {
                return; // Already synced
            }

            this.format = format;
            const streams = this._isInstance ? format.instanceStreams : format.resourceStreams;

            // Create new textures for added streams
            for (const stream of streams) {
                if (!this.textures.has(stream.name)) {
                    const texture = this.createTexture(stream.name, stream.format, this._textureDimensions);
                    this.textures.set(stream.name, texture);
                }
            }

            this._formatVersion = format.extraStreamsVersion;
        }
    }

    /**
     * Resizes all managed textures to the specified dimensions. This assumes all textures
     * have uniform dimensions (e.g. work buffer textures). Do not use on resources with
     * mixed-size textures (e.g. SOG with differently-sized SH textures).
     *
     * @param {number} width - The new width.
     * @param {number} height - The new height.
     */
    resize(width, height) {
        this._textureDimensions.set(width, height);
        for (const texture of this.textures.values()) {
            texture.resize(width, height);
        }
    }

    /**
     * Creates a new texture with the specified parameters.
     *
     * @param {string} name - The name of the texture to be created.
     * @param {number} format - The pixel format of the texture.
     * @param {Vec2} size - The size of the texture in a Vec2 object, containing width (x) and height (y).
     * @param {Uint8Array|Uint16Array|Uint32Array|Float32Array} [data] - The initial data to fill the texture with.
     * @returns {Texture} The created texture instance.
     */
    createTexture(name, format, size, data) {
        return Texture.createDataTexture2D(this.device, name, size.x, size.y, format, data ? [data] : undefined);
    }
}

export { GSplatStreams };
