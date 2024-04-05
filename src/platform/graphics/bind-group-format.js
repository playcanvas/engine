import { TRACEID_BINDGROUPFORMAT_ALLOC } from '../../core/constants.js';
import { Debug, DebugHelper } from '../../core/debug.js';

import {
    TEXTUREDIMENSION_2D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_2D_ARRAY,
    SAMPLETYPE_FLOAT, PIXELFORMAT_RGBA8, SAMPLETYPE_INT, SAMPLETYPE_UINT, SHADERSTAGE_COMPUTE
} from './constants.js';

let id = 0;

const textureDimensionInfo = {
    [TEXTUREDIMENSION_2D]: 'texture2D',
    [TEXTUREDIMENSION_CUBE]: 'textureCube',
    [TEXTUREDIMENSION_3D]: 'texture3D',
    [TEXTUREDIMENSION_2D_ARRAY]: 'texture2DArray'
};

/**
 * @ignore
 */
class BindBaseFormat {
    /** @type {number} */
    slot = -1;

    /** @type {import('./scope-id.js').ScopeId|null} */
    scopeId = null;

    constructor(name, visibility) {
        /** @type {string} */
        this.name = name;

        // SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, SHADERSTAGE_COMPUTE
        this.visibility = visibility;
    }
}

/**
 * @ignore
 */
class BindUniformBufferFormat extends BindBaseFormat {
}

/**
 * @ignore
 */
class BindStorageBufferFormat extends BindBaseFormat {
    constructor(name, visibility, readOnly = false) {
        super(name, visibility);

        // whether the buffer is read-only
        this.readOnly = readOnly;
    }
}

/**
 * @ignore
 */
class BindTextureFormat extends BindBaseFormat {
    constructor(name, visibility, textureDimension = TEXTUREDIMENSION_2D, sampleType = SAMPLETYPE_FLOAT, hasSampler = true) {
        super(name, visibility);

        // TEXTUREDIMENSION_***
        this.textureDimension = textureDimension;

        // SAMPLETYPE_***
        this.sampleType = sampleType;

        // whether to use a sampler with this texture
        this.hasSampler = hasSampler;
    }
}

/**
 * @ignore
 */
class BindStorageTextureFormat extends BindBaseFormat {
    constructor(name, format = PIXELFORMAT_RGBA8, textureDimension = TEXTUREDIMENSION_2D) {
        super(name, SHADERSTAGE_COMPUTE);

        // PIXELFORMAT_***
        this.format = format;

        // TEXTUREDIMENSION_***
        this.textureDimension = textureDimension;
    }
}

/**
 * @ignore
 */
class BindGroupFormat {
    /** @type {BindUniformBufferFormat[]} */
    uniformBufferFormats = [];

    /** @type {BindTextureFormat[]} */
    textureFormats = [];

    /** @type {BindStorageTextureFormat[]} */
    storageTextureFormats = [];

    /** @type {BindStorageBufferFormat[]} */
    storageBufferFormats = [];

    /**
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this vertex format.
     * @param {(BindBaseFormat|BindTextureFormat|BindStorageTextureFormat|BindStorageBufferFormat)[]} formats
     * - An array of bind formats.
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

        /** @type {import('./graphics-device.js').GraphicsDevice} */
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

        Debug.trace(TRACEID_BINDGROUPFORMAT_ALLOC, `Alloc: Id ${this.id}`, this);
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
     */
    getStorageTexture(name) {
        const index = this.storageTextureFormatsMap.get(name);
        if (index !== undefined) {
            return this.storageTextureFormats[index];
        }

        return null;
    }

    getShaderDeclarationTextures(bindGroup) {
        let code = '';
        this.textureFormats.forEach((format) => {

            let textureType = textureDimensionInfo[format.textureDimension];
            Debug.assert(textureType, "Unsupported texture type", format.textureDimension);

            // handle texture2DArray by renaming the texture object and defining a replacement macro
            let namePostfix = '';
            let extraCode = '';
            if (textureType === 'texture2DArray') {
                namePostfix = '_texture';
                extraCode = `#define ${format.name} sampler2DArray(${format.name}${namePostfix}, ${format.name}_sampler)\n`;
            }

            if (format.sampleType === SAMPLETYPE_INT) {
                textureType = `i${textureType}`;
            } else if (format.sampleType === SAMPLETYPE_UINT) {
                textureType = `u${textureType}`;
            }

            code += `layout(set = ${bindGroup}, binding = ${format.slot}) uniform ${textureType} ${format.name}${namePostfix};\n`;
            if (format.hasSampler) {
                code += `layout(set = ${bindGroup}, binding = ${format.slot + 1}) uniform sampler ${format.name}_sampler;\n`;
            }
            code += extraCode;
        });

        return code;
    }

    loseContext() {
        // TODO: implement
    }
}

export { BindUniformBufferFormat, BindTextureFormat, BindGroupFormat, BindStorageTextureFormat, BindStorageBufferFormat };
