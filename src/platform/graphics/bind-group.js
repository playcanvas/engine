import { Debug } from '../../core/debug.js';
import { TRACEID_BINDGROUP_ALLOC } from '../../core/constants.js';
import { UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';
import { DebugGraphics } from './debug-graphics.js';

let id = 0;

/**
 * Data structure to hold a bind group and its offsets. This is used by {@link UniformBuffer#update}
 * to return a dynamic bind group and offset for the uniform buffer.
 *
 * @ignore
 */
class DynamicBindGroup {
    bindGroup;

    offsets = [];
}

/**
 * A bind group represents a collection of {@link UniformBuffer}, {@link Texture} and
 * {@link StorageBuffer} instanced, which can be bind on a GPU for rendering.
 *
 * @ignore
 */
class BindGroup {
    /**
     * A render version the bind group was last updated on.
     *
     * @type {number}
     * @ignore
     */
    renderVersionUpdated = -1;

    /** @type {import('./uniform-buffer.js').UniformBuffer[]} */
    uniformBuffers;

    /**
     * An array of offsets for each uniform buffer in the bind group. This is the offset in the
     * buffer where the uniform buffer data starts.
     *
     * @type {number[]}
     */
    uniformBufferOffsets = [];

    /**
     * Create a new Bind Group.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this uniform buffer.
     * @param {import('./bind-group-format.js').BindGroupFormat} format - Format of the bind group.
     * @param {import('./uniform-buffer.js').UniformBuffer} [defaultUniformBuffer] - The default
     * uniform buffer. Typically a bind group only has a single uniform buffer, and this allows
     * easier access.
     */
    constructor(graphicsDevice, format, defaultUniformBuffer) {
        this.id = id++;
        this.device = graphicsDevice;
        this.format = format;
        this.dirty = true;
        this.impl = graphicsDevice.createBindGroupImpl(this);

        this.textures = [];
        this.storageTextures = [];
        this.storageBuffers = [];
        this.uniformBuffers = [];

        /** @type {import('./uniform-buffer.js').UniformBuffer} */
        this.defaultUniformBuffer = defaultUniformBuffer;
        if (defaultUniformBuffer) {
            this.setUniformBuffer(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, defaultUniformBuffer);
        }

        Debug.trace(TRACEID_BINDGROUP_ALLOC, `Alloc: Id ${this.id}`, this, format);
    }

    /**
     * Frees resources associated with this bind group.
     */
    destroy() {
        this.impl.destroy();
        this.impl = null;
        this.format = null;
        this.defaultUniformBuffer = null;
    }

    /**
     * Assign a uniform buffer to a slot.
     *
     * @param {string} name - The name of the uniform buffer slot
     * @param {import('./uniform-buffer.js').UniformBuffer} uniformBuffer - The Uniform buffer to
     * assign to the slot.
     */
    setUniformBuffer(name, uniformBuffer) {
        const index = this.format.bufferFormatsMap.get(name);
        Debug.assert(index !== undefined, `Setting a uniform [${name}] on a bind group with id ${this.id} which does not contain it, while rendering [${DebugGraphics.toString()}]`, this);
        if (this.uniformBuffers[index] !== uniformBuffer) {
            this.uniformBuffers[index] = uniformBuffer;
            this.dirty = true;
        }
    }

    /**
     * Assign a storage buffer to a slot.
     *
     * @param {string} name - The name of the storage buffer slot.
     * @param {import('./storage-buffer.js').StorageBuffer} storageBuffer - The storage buffer to
     * assign to the slot.
     */
    setStorageBuffer(name, storageBuffer) {
        const index = this.format.storageBufferFormatsMap.get(name);
        Debug.assert(index !== undefined, `Setting a storage buffer [${name}] on a bind group with id: ${this.id} which does not contain it, while rendering [${DebugGraphics.toString()}]`, this);
        if (this.storageBuffers[index] !== storageBuffer) {
            this.storageBuffers[index] = storageBuffer;
            this.dirty = true;
        }
    }

    /**
     * Assign a texture to a named slot.
     *
     * @param {string} name - The name of the texture slot.
     * @param {import('./texture.js').Texture} texture - Texture to assign to the slot.
     */
    setTexture(name, texture) {
        const index = this.format.textureFormatsMap.get(name);
        Debug.assert(index !== undefined, `Setting a texture [${name}] on a bind group with id: ${this.id} which does not contain it, while rendering [${DebugGraphics.toString()}]`, this);
        if (this.textures[index] !== texture) {
            this.textures[index] = texture;
            this.dirty = true;
        } else if (this.renderVersionUpdated < texture.renderVersionDirty) {
            // if the texture properties have changed
            this.dirty = true;
        }
    }

    /**
     * Assign a storage texture to a named slot.
     *
     * @param {string} name - The name of the texture slot.
     * @param {import('./texture.js').Texture} texture - Texture to assign to the slot.
     */
    setStorageTexture(name, texture) {
        const index = this.format.storageTextureFormatsMap.get(name);
        Debug.assert(index !== undefined, `Setting a storage texture [${name}] on a bind group with id: ${this.id} which does not contain it, while rendering [${DebugGraphics.toString()}]`, this);
        if (this.storageTextures[index] !== texture) {
            this.storageTextures[index] = texture;
            this.dirty = true;
        } else if (this.renderVersionUpdated < texture.renderVersionDirty) {
            // if the texture properties have changed
            this.dirty = true;
        }
    }

    /**
     * Updates the uniform buffers in this bind group.
     */
    updateUniformBuffers() {
        for (let i = 0; i < this.uniformBuffers.length; i++) {
            this.uniformBuffers[i].update();
        }
    }

    /**
     * Applies any changes made to the bind group's properties. Note that the content of used
     * uniform buffers needs to be updated before calling this method.
     */
    update() {

        // TODO: implement faster version of this, which does not call SetTexture, which does a map lookup
        const { textureFormats, storageTextureFormats, storageBufferFormats } = this.format;

        for (let i = 0; i < textureFormats.length; i++) {
            const textureFormat = textureFormats[i];
            const value = textureFormat.scopeId.value;
            Debug.assert(value, `Value was not set when assigning texture slot [${textureFormat.name}] to a bind group, while rendering [${DebugGraphics.toString()}]`, this);
            this.setTexture(textureFormat.name, value);
        }

        for (let i = 0; i < storageTextureFormats.length; i++) {
            const storageTextureFormat = storageTextureFormats[i];
            const value = storageTextureFormat.scopeId.value;
            Debug.assert(value, `Value was not set when assigning storage texture slot [${storageTextureFormat.name}] to a bind group, while rendering [${DebugGraphics.toString()}]`, this);
            this.setStorageTexture(storageTextureFormat.name, value);
        }

        for (let i = 0; i < storageBufferFormats.length; i++) {
            const storageBufferFormat = storageBufferFormats[i];
            const value = storageBufferFormat.scopeId.value;
            Debug.assert(value, `Value was not set when assigning storage buffer slot [${storageBufferFormat.name}] to a bind group, while rendering [${DebugGraphics.toString()}]`, this);
            this.setStorageBuffer(storageBufferFormat.name, value);
        }

        // update uniform buffer offsets
        this.uniformBufferOffsets.length = this.uniformBuffers.length;
        for (let i = 0; i < this.uniformBuffers.length; i++) {
            const uniformBuffer = this.uniformBuffers[i];

            // offset
            this.uniformBufferOffsets[i] = uniformBuffer.offset;

            // test if any of the uniform buffers have changed (not their content, but the buffer container itself)
            if (this.renderVersionUpdated < uniformBuffer.renderVersionDirty) {
                this.dirty = true;
            }
        }

        if (this.dirty) {
            this.dirty = false;
            this.renderVersionUpdated = this.device.renderVersion;
            this.impl.update(this);
        }
    }
}

export { BindGroup, DynamicBindGroup };
