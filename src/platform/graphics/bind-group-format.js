import { TRACEID_BINDGROUPFORMAT_ALLOC } from '../../core/constants.js';
import { Debug, DebugHelper } from '../../core/debug.js';

import {
    TEXTUREDIMENSION_2D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_3D,
    SAMPLETYPE_FLOAT
} from './constants.js';

let id = 0;

const textureDimensionInfo = {
    [TEXTUREDIMENSION_2D]: 'texture2D',
    [TEXTUREDIMENSION_CUBE]: 'textureCube',
    [TEXTUREDIMENSION_3D]: 'texture3D'
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
class BindGroupFormat {
    /**
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this vertex format.
     * @param {BindBufferFormat[]} [bufferFormats] - An array of bind buffer formats (uniform
     * buffers). Defaults to an empty array.
     * @param {BindTextureFormat[]} [textureFormats] - An array of bind texture formats (textures).
     * Defaults to an empty array.
     */
    constructor(graphicsDevice, bufferFormats = [], textureFormats = []) {
        this.id = id++;
        DebugHelper.setName(this, `BindGroupFormat_${this.id}`);

        /** @type {import('./graphics-device.js').GraphicsDevice} */
        this.device = graphicsDevice;

        /** @type {BindBufferFormat[]} */
        this.bufferFormats = bufferFormats;

        // maps a buffer format name to an index
        /** @type {Map<string, number>} */
        this.bufferFormatsMap = new Map();
        bufferFormats.forEach((bf, i) => this.bufferFormatsMap.set(bf.name, i));

        /** @type {BindTextureFormat[]} */
        this.textureFormats = textureFormats;

        const scope = graphicsDevice.scope;

        // maps a texture format name to a slot index
        /** @type {Map<string, number>} */
        this.textureFormatsMap = new Map();
        textureFormats.forEach((tf, i) => {
            this.textureFormatsMap.set(tf.name, i);

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
     * @returns {BindTextureFormat} - The format.
     */
    getTexture(name) {
        const index = this.textureFormatsMap.get(name);
        if (index !== undefined) {
            return this.textureFormats[index];
        }

        return null;
    }

    getShaderDeclarationTextures(bindGroup) {
        let code = '';
        let bindIndex = this.bufferFormats.length;
        this.textureFormats.forEach((format) => {

            const textureType = textureDimensionInfo[format.textureDimension];
            Debug.assert(textureType, "Unsupported texture type");

            code += `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform ${textureType} ${format.name};\n` +
                    `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform sampler ${format.name}_sampler;\n`;
        });

        return code;
    }

    loseContext() {
        // TODO: implement
    }
}

export { BindBufferFormat, BindTextureFormat, BindGroupFormat };
