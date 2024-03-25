import { TRACEID_BINDGROUPFORMAT_ALLOC } from '../../core/constants.js';
import { Debug, DebugHelper } from '../../core/debug.js';

import {
    TEXTUREDIMENSION_2D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_2D_ARRAY,
    SAMPLETYPE_FLOAT, PIXELFORMAT_RGBA8, SAMPLETYPE_INT, SAMPLETYPE_UINT
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
class BindBufferFormat {
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
class BindTextureFormat {
    /** @type {import('./scope-id.js').ScopeId} */
    scopeId;

    constructor(name, visibility, textureDimension = TEXTUREDIMENSION_2D, sampleType = SAMPLETYPE_FLOAT) {
        /** @type {string} */
        this.name = name;

        // SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, SHADERSTAGE_COMPUTE
        this.visibility = visibility;

        // TEXTUREDIMENSION_***
        this.textureDimension = textureDimension;

        // SAMPLETYPE_***
        this.sampleType = sampleType;
    }
}

/**
 * @ignore
 */
class BindStorageTextureFormat {
    /** @type {import('./scope-id.js').ScopeId} */
    scopeId;

    constructor(name, format = PIXELFORMAT_RGBA8, textureDimension = TEXTUREDIMENSION_2D) {
        /** @type {string} */
        this.name = name;

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
    compute = false;

    /**
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this vertex format.
     * @param {BindBufferFormat[]} [bufferFormats] - An array of bind buffer formats (uniform
     * buffers). Defaults to an empty array.
     * @param {BindTextureFormat[]} [textureFormats] - An array of bind texture formats (textures).
     * Defaults to an empty array.
     * @param {BindStorageTextureFormat[]} [storageTextureFormats] - An array of bind storage texture
     * formats (storage textures), used by the compute shader. Defaults to an empty array.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {boolean} [options.compute] - If true, this bind group format is used by the compute
     * shader.
     */
    constructor(graphicsDevice, bufferFormats = [], textureFormats = [], storageTextureFormats = [], options = {}) {
        this.id = id++;
        DebugHelper.setName(this, `BindGroupFormat_${this.id}`);

        this.compute = options.compute ?? false;
        Debug.assert(this.compute || storageTextureFormats.length === 0, "Storage textures can be specified only for compute");

        /** @type {import('./graphics-device.js').GraphicsDevice} */
        this.device = graphicsDevice;
        const scope = graphicsDevice.scope;

        /** @type {BindBufferFormat[]} */
        this.bufferFormats = bufferFormats;

        // maps a buffer format name to an index
        /** @type {Map<string, number>} */
        this.bufferFormatsMap = new Map();
        bufferFormats.forEach((bf, i) => this.bufferFormatsMap.set(bf.name, i));

        /** @type {BindTextureFormat[]} */
        this.textureFormats = textureFormats;

        // maps a texture format name to a slot index
        /** @type {Map<string, number>} */
        this.textureFormatsMap = new Map();
        textureFormats.forEach((tf, i) => {
            this.textureFormatsMap.set(tf.name, i);

            // resolve scope id
            tf.scopeId = scope.resolve(tf.name);
        });

        /** @type {BindStorageTextureFormat[]} */
        this.storageTextureFormats = storageTextureFormats;

        // maps a storage texture format name to a slot index
        /** @type {Map<string, number>} */
        this.storageTextureFormatsMap = new Map();
        storageTextureFormats.forEach((tf, i) => {
            this.storageTextureFormatsMap.set(tf.name, i);

            // resolve scope id
            tf.scopeId = scope.resolve(tf.name);
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
        let bindIndex = this.bufferFormats.length;
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

            code += `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform ${textureType} ${format.name}${namePostfix};\n` +
                    `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform sampler ${format.name}_sampler;\n` +
                    extraCode;

        });

        return code;
    }

    loseContext() {
        // TODO: implement
    }
}

export { BindBufferFormat, BindTextureFormat, BindGroupFormat, BindStorageTextureFormat };
