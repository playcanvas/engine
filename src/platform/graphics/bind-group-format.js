import { TRACEID_BINDGROUPFORMAT_ALLOC } from '../../core/constants.js';
import { Debug, DebugHelper } from '../../core/debug.js';
import {
    TEXTUREDIMENSION_2D,
    SAMPLETYPE_FLOAT, PIXELFORMAT_RGBA8, SHADERSTAGE_COMPUTE, SHADERSTAGE_VERTEX
} from './constants.js';
import { DebugGraphics } from './debug-graphics.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { ScopeId } from './scope-id.js'
 */

let id = 0;

/**
 * A base class to describe the format of the resource for {@link BindGroupFormat}.
 *
 * @category Graphics
 */
class BindBaseFormat {
    /**
     * @type {number}
     * @ignore
     */
    slot = -1;

    /**
     * @type {ScopeId|null}
     * @ignore
     */
    scopeId = null;

    /**
     * Create a new instance.
     *
     * @param {string} name - The name of the resource.
     * @param {number} visibility - A bit-flag that specifies the shader stages in which the resource
     * is visible. Can be:
     *
     * - {@link SHADERSTAGE_VERTEX}
     * - {@link SHADERSTAGE_FRAGMENT}
     * - {@link SHADERSTAGE_COMPUTE}
     */
    constructor(name, visibility) {
        /** @type {string} */
        this.name = name;

        // SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, SHADERSTAGE_COMPUTE
        this.visibility = visibility;
    }
}

/**
 * A class to describe the format of the uniform buffer for {@link BindGroupFormat}.
 *
 * @category Graphics
 */
class BindUniformBufferFormat extends BindBaseFormat {
}

/**
 * A class to describe the format of the storage buffer for {@link BindGroupFormat}.
 *
 * @category Graphics
 */
class BindStorageBufferFormat extends BindBaseFormat {
    /**
     * Format, extracted from vertex and fragment shader.
     *
     * @type {string}
     * @ignore
     */
    format = '';

    /**
     * Create a new instance.
     *
     * @param {string} name - The name of the storage buffer.
     * @param {number} visibility - A bit-flag that specifies the shader stages in which the storage
     * buffer is visible. Can be:
     *
     * - {@link SHADERSTAGE_VERTEX}
     * - {@link SHADERSTAGE_FRAGMENT}
     * - {@link SHADERSTAGE_COMPUTE}
     *
     * @param {boolean} [readOnly] - Whether the storage buffer is read-only, or read-write. Defaults
     * to false. This has to be true for the storage buffer used in the vertex shader.
     */
    constructor(name, visibility, readOnly = false) {
        super(name, visibility);

        // whether the buffer is read-only
        this.readOnly = readOnly;
        Debug.assert(readOnly || !(visibility & SHADERSTAGE_VERTEX), 'Storage buffer can only be used in read-only mode in SHADERSTAGE_VERTEX.');
    }
}

/**
 * A class to describe the format of the texture for {@link BindGroupFormat}.
 *
 * @category Graphics
 */
class BindTextureFormat extends BindBaseFormat {
    /**
     * Create a new instance.
     *
     * @param {string} name - The name of the storage buffer.
     * @param {number} visibility - A bit-flag that specifies the shader stages in which the storage
     * buffer is visible. Can be:
     *
     * - {@link SHADERSTAGE_VERTEX}
     * - {@link SHADERSTAGE_FRAGMENT}
     * - {@link SHADERSTAGE_COMPUTE}
     *
     * @param {string} [textureDimension] - The dimension of the texture. Defaults to
     * {@link TEXTUREDIMENSION_2D}. Can be:
     *
     * - {@link TEXTUREDIMENSION_1D}
     * - {@link TEXTUREDIMENSION_2D}
     * - {@link TEXTUREDIMENSION_2D_ARRAY}
     * - {@link TEXTUREDIMENSION_CUBE}
     * - {@link TEXTUREDIMENSION_CUBE_ARRAY}
     * - {@link TEXTUREDIMENSION_3D}
     *
     * @param {number} [sampleType] - The type of the texture samples. Defaults to
     * {@link SAMPLETYPE_FLOAT}. Can be:
     *
     * - {@link SAMPLETYPE_FLOAT}
     * - {@link SAMPLETYPE_UNFILTERABLE_FLOAT}
     * - {@link SAMPLETYPE_DEPTH}
     * - {@link SAMPLETYPE_INT}
     * - {@link SAMPLETYPE_UINT}
     *
     * @param {boolean} [hasSampler] - True if the sampler for the texture is needed. Note that if the
     * sampler is used, it will take up an additional slot, directly following the texture slot.
     * Defaults to true.
     * @param {string|null} [samplerName] - Optional name of the sampler. Defaults to null.
     */
    constructor(name, visibility, textureDimension = TEXTUREDIMENSION_2D, sampleType = SAMPLETYPE_FLOAT, hasSampler = true, samplerName = null) {
        super(name, visibility);

        // TEXTUREDIMENSION_***
        this.textureDimension = textureDimension;

        // SAMPLETYPE_***
        this.sampleType = sampleType;

        // whether to use a sampler with this texture
        this.hasSampler = hasSampler;

        // optional name of the sampler (its automatically generated if not provided)
        this.samplerName = samplerName ?? `${name}_sampler`;
    }
}

/**
 * A class to describe the format of the storage texture for {@link BindGroupFormat}. Storage
 * texture is a texture created with the storage flag set to true, which allows it to be used as an
 * output of a compute shader.
 *
 * Note: At the current time, storage textures are only supported in compute shaders in a
 * write-only mode.
 *
 * @category Graphics
 */
class BindStorageTextureFormat extends BindBaseFormat {
    /**
     * Create a new instance.
     *
     * @param {string} name - The name of the storage buffer.
     * @param {number} [format] - The pixel format of the texture. Note that not all formats can be
     * used. Defaults to {@link PIXELFORMAT_RGBA8}.
     * @param {string} [textureDimension] - The dimension of the texture. Defaults to
     * {@link TEXTUREDIMENSION_2D}. Can be:
     *
     * - {@link TEXTUREDIMENSION_1D}
     * - {@link TEXTUREDIMENSION_2D}
     * - {@link TEXTUREDIMENSION_2D_ARRAY}
     * - {@link TEXTUREDIMENSION_3D}
     *
     * @param {boolean} [write] - Whether the storage texture is writeable. Defaults to true.
     * @param {boolean} [read] - Whether the storage texture is readable. Defaults to false. Note
     * that storage texture reads are only supported if
     * {@link GraphicsDevice#supportsStorageTextureRead} is true. Also note that only a subset of
     * pixel formats can be used for storage texture reads - as an example, PIXELFORMAT_RGBA8 is not
     * compatible, but PIXELFORMAT_R32U is.
     */
    constructor(name, format = PIXELFORMAT_RGBA8, textureDimension = TEXTUREDIMENSION_2D, write = true, read = false) {
        super(name, SHADERSTAGE_COMPUTE);

        // PIXELFORMAT_***
        this.format = format;

        // TEXTUREDIMENSION_***
        this.textureDimension = textureDimension;

        // whether the texture is writeable
        this.write = write;

        // whether the texture is readable
        this.read = read;
    }
}

/**
 * BindGroupFormat is a data structure that defines the layout of resources (buffers, textures,
 * samplers) used by rendering or compute shaders. It describes the binding points for each
 * resource type, and the visibility of these resources in the shader stages.
 * Currently this class is only used on WebGPU platform to specify the input and output resources
 * for vertex, fragment and compute shaders written in {@link SHADERLANGUAGE_WGSL} language.
 *
 * @category Graphics
 */
class BindGroupFormat {
    /**
     * @type {BindUniformBufferFormat[]}
     * @private
     */
    uniformBufferFormats = [];

    /**
     * @type {BindTextureFormat[]}
     * @private
     */
    textureFormats = [];

    /**
     * @type {BindStorageTextureFormat[]}
     * @private
     */
    storageTextureFormats = [];

    /**
     * @type {BindStorageBufferFormat[]}
     * @private
     */
    storageBufferFormats = [];

    /**
     * Create a new instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this vertex format.
     * @param {(BindTextureFormat|BindStorageTextureFormat|BindUniformBufferFormat|BindStorageBufferFormat)[]} formats -
     * An array of bind formats. Note that each entry in the array uses up one slot. The exception
     * is a texture format that has a sampler, which uses up two slots. The slots are allocated
     * sequentially, starting from 0.
     */
    constructor(graphicsDevice, formats) {
        this.id = id++;
        DebugHelper.setName(this, `BindGroupFormat_${this.id}`);

        Debug.assert(formats);

        let slot = 0;
        formats.forEach((format) => {

            // Assign slot. For texture format, we also need to assign a slot for its sampler.
            format.slot = slot++;
            if (format instanceof BindTextureFormat && format.hasSampler) {
                slot++;
            }

            // split the array into separate arrays
            if (format instanceof BindUniformBufferFormat) {
                this.uniformBufferFormats.push(format);
            } else if (format instanceof BindTextureFormat) {
                this.textureFormats.push(format);
            } else if (format instanceof BindStorageTextureFormat) {
                this.storageTextureFormats.push(format);
            } else if (format instanceof BindStorageBufferFormat) {
                this.storageBufferFormats.push(format);
            } else {
                Debug.assert('Invalid bind format', format);
            }
        });

        /** @type {GraphicsDevice} */
        this.device = graphicsDevice;
        const scope = graphicsDevice.scope;

        // maps a buffer format name to an index
        /** @type {Map<string, number>} */
        this.bufferFormatsMap = new Map();
        this.uniformBufferFormats.forEach((bf, i) => this.bufferFormatsMap.set(bf.name, i));

        // maps a texture format name to a slot index
        /** @type {Map<string, number>} */
        this.textureFormatsMap = new Map();
        this.textureFormats.forEach((tf, i) => {
            this.textureFormatsMap.set(tf.name, i);

            // resolve scope id
            tf.scopeId = scope.resolve(tf.name);
        });

        // maps a storage texture format name to a slot index
        /** @type {Map<string, number>} */
        this.storageTextureFormatsMap = new Map();
        this.storageTextureFormats.forEach((tf, i) => {
            this.storageTextureFormatsMap.set(tf.name, i);

            // resolve scope id
            tf.scopeId = scope.resolve(tf.name);
        });

        // maps a storage buffer format name to a slot index
        /** @type {Map<string, number>} */
        this.storageBufferFormatsMap = new Map();
        this.storageBufferFormats.forEach((bf, i) => {
            this.storageBufferFormatsMap.set(bf.name, i);

            // resolve scope id
            bf.scopeId = scope.resolve(bf.name);
        });

        this.impl = graphicsDevice.createBindGroupFormatImpl(this);

        Debug.trace(TRACEID_BINDGROUPFORMAT_ALLOC, `Alloc: Id ${this.id}, while rendering [${DebugGraphics.toString()}]`, this);
    }

    /**
     * Frees resources associated with this bind group.
     */
    destroy() {
        this.impl.destroy();
    }

    /**
     * Returns format of texture with specified name.
     *
     * @param {string} name - The name of the texture slot.
     * @returns {BindTextureFormat|null} - The format.
     * @ignore
     */
    getTexture(name) {
        const index = this.textureFormatsMap.get(name);
        if (index !== undefined) {
            return this.textureFormats[index];
        }

        return null;
    }

    /**
     * Returns format of storage texture with specified name.
     *
     * @param {string} name - The name of the texture slot.
     * @returns {BindStorageTextureFormat|null} - The format.
     * @ignore
     */
    getStorageTexture(name) {
        const index = this.storageTextureFormatsMap.get(name);
        if (index !== undefined) {
            return this.storageTextureFormats[index];
        }

        return null;
    }

    loseContext() {
        // TODO: implement
    }
}

export { BindUniformBufferFormat, BindTextureFormat, BindGroupFormat, BindStorageTextureFormat, BindStorageBufferFormat };
