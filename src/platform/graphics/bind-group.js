import { Debug } from '../../core/debug.js';
import { TRACEID_BINDGROUP_ALLOC } from '../../core/constants.js';
import { UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';
import { DebugGraphics } from './debug-graphics.js';
import { TextureView } from './texture-view.js';

/**
 * @import { BindGroupFormat, BindTextureFormat } from './bind-group-format.js'
 * @import { DynamicBuffer } from './dynamic-buffer.js'
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { StorageBuffer } from './storage-buffer.js'
 * @import { Texture } from './texture.js'
 * @import { UniformBuffer } from './uniform-buffer.js'
 */

let id = 0;

/**
 * Data structure to hold a bind group and its offsets. This is used by {@link UniformBuffer#update}
 * to return a dynamic bind group and offset for the uniform buffer.
 *
 * @ignore
 */
class DynamicBindGroup {
    bindGroup;

    /**
     * The dynamic offset of the uniform buffer. A typed array, which the WebGPU device passes to
     * setBindGroup without a per-call conversion.
     *
     * @type {Uint32Array}
     */
    offsets = new Uint32Array(1);
}

/**
 * A bind group represents a collection of {@link UniformBuffer}, {@link Texture} and
 * {@link StorageBuffer} instanced, which can be bind on a GPU for rendering.
 *
 * Call {@link BindGroup#destroy} when no longer needed. On WebGPU, the graphics device retains
 * bind groups for device recovery until they are explicitly destroyed.
 *
 * @ignore
 */
class BindGroup {
    /**
     * A render version the bind group was last updated on.
     *
     * @private
     */
    renderVersionUpdated = -1;

    /** @type {UniformBuffer[]} */
    uniformBuffers;

    /**
     * The offset of each uniform buffer of the format in the buffer where its data starts. A typed
     * array of one entry per uniform buffer slot, which the WebGPU device passes to setBindGroup
     * without a per-call conversion, and which holds exactly the number of dynamic offsets the bind
     * group layout requires.
     *
     * @type {Uint32Array}
     */
    uniformBufferOffsets;

    /**
     * For each uniform buffer slot, the dynamic GPU buffer a non-persistent uniform buffer was
     * last built against. Used to detect when such a buffer is re-allocated into a different
     * dynamic buffer (which requires the bind group to be rebuilt).
     *
     * @type {DynamicBuffer[]}
     * @private
     */
    _uniformBufferContainers = [];

    /**
     * For each texture / storage-texture slot, the GPU implementation object the slot was last
     * built against. A texture's `impl` is replaced when its GPU resource is recreated (e.g.
     * {@link Texture#resize}), which can happen mid-render in the same render version the bind
     * group was last built — so the {@link renderVersionDirty} check alone misses it and the bind
     * group keeps a view of the (now destroyed) old GPU texture. Tracking impl identity forces a
     * rebuild whenever the underlying GPU resource is recreated.
     *
     * @type {object[]}
     * @private
     */
    _textureImpls = [];

    /**
     * @type {object[]}
     * @private
     */
    _storageTextureImpls = [];

    /**
     * Create a new Bind Group.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this uniform buffer.
     * @param {BindGroupFormat} format - Format of the bind group.
     * @param {UniformBuffer} [defaultUniformBuffer] - The default uniform buffer. Typically a bind
     * group only has a single uniform buffer, and this allows easier access.
     */
    constructor(graphicsDevice, format, defaultUniformBuffer) {
        this.id = id++;
        this.device = graphicsDevice;
        this.format = format;
        this.dirty = true;
        this.uniformBufferOffsets = new Uint32Array(format.uniformBufferFormats.length);
        this.impl = graphicsDevice.createBindGroupImpl(this);

        /** @type {(Texture|TextureView)[]} */
        this.textures = [];
        /** @type {(Texture|TextureView)[]} */
        this.storageTextures = [];
        this.storageBuffers = [];
        this.uniformBuffers = [];

        /** @type {UniformBuffer} */
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
     * @param {UniformBuffer} uniformBuffer - The Uniform buffer to assign to the slot.
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
     * @param {StorageBuffer} storageBuffer - The storage buffer to assign to the slot.
     */
    setStorageBuffer(name, storageBuffer) {
        const index = this.format.storageBufferFormatsMap.get(name);
        Debug.assert(index !== undefined, `Setting a storage buffer [${name}] on a bind group with id: ${this.id} which does not contain it, while rendering [${DebugGraphics.toString()}]`, this);
        this.setStorageBufferAt(index, storageBuffer);
    }

    /**
     * Assign a storage buffer to a slot, given its index in the format's storage buffers.
     *
     * @param {number} index - The index of the storage buffer slot.
     * @param {StorageBuffer} storageBuffer - The storage buffer to assign to the slot.
     * @private
     */
    setStorageBufferAt(index, storageBuffer) {
        if (this.storageBuffers[index] !== storageBuffer) {
            this.storageBuffers[index] = storageBuffer;
            this.dirty = true;
        }
    }

    /**
     * Assign a texture to a named slot.
     *
     * @param {string} name - The name of the texture slot.
     * @param {Texture|TextureView} value - Texture or TextureView to assign to the slot.
     */
    setTexture(name, value) {
        const index = this.format.textureFormatsMap.get(name);
        Debug.assert(index !== undefined, `Setting a texture [${name}] on a bind group with id: ${this.id} which does not contain it, while rendering [${DebugGraphics.toString()}]`, this);
        this.setTextureAt(index, value);
    }

    /**
     * Assign a texture to a slot, given its index in the format's textures. This is the form the
     * update uses, as it walks the slots in order and so knows the index without looking it up,
     * and the form an owner of the bind group uses when it tracks the slots of its own resources.
     *
     * @param {number} index - The index of the texture slot.
     * @param {Texture|TextureView} value - Texture or TextureView to assign to the slot.
     * @ignore
     */
    setTextureAt(index, value) {

        // Get the actual texture for version checking
        const texture = value instanceof TextureView ? value.texture : value;

        if (this.textures[index] !== value) {
            this.textures[index] = value;
            this.dirty = true;
        } else if (this.renderVersionUpdated < texture.renderVersionDirty) {
            // if the texture properties have changed
            this.dirty = true;
        } else if (this._textureImpls[index] !== texture.impl) {
            // the texture's GPU resource was recreated (e.g. resize) since the last build
            this.dirty = true;
        }
        this._textureImpls[index] = texture.impl;
    }

    /**
     * Assign a storage texture to a named slot.
     *
     * @param {string} name - The name of the texture slot.
     * @param {Texture|TextureView} value - Texture or TextureView to assign to the slot.
     */
    setStorageTexture(name, value) {
        const index = this.format.storageTextureFormatsMap.get(name);
        Debug.assert(index !== undefined, `Setting a storage texture [${name}] on a bind group with id: ${this.id} which does not contain it, while rendering [${DebugGraphics.toString()}]`, this);
        this.setStorageTextureAt(index, value);
    }

    /**
     * Assign a storage texture to a slot, given its index in the format's storage textures.
     *
     * @param {number} index - The index of the storage texture slot.
     * @param {Texture|TextureView} value - Texture or TextureView to assign to the slot.
     * @private
     */
    setStorageTextureAt(index, value) {

        // Get the actual texture for version checking
        const texture = value instanceof TextureView ? value.texture : value;

        if (this.storageTextures[index] !== value) {
            this.storageTextures[index] = value;
            this.dirty = true;
        } else if (this.renderVersionUpdated < texture.renderVersionDirty) {
            // if the texture properties have changed
            this.dirty = true;
        } else if (this._storageTextureImpls[index] !== texture.impl) {
            // the texture's GPU resource was recreated (e.g. resize) since the last build
            this.dirty = true;
        }
        this._storageTextureImpls[index] = texture.impl;
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
     * Applies any changes made to the bind group's properties, taking the value of each texture,
     * storage texture and storage buffer slot from the scope. Note that the content of used
     * uniform buffers needs to be updated before calling this method.
     */
    update() {
        this._assignFromScope();
        this._finalize();
    }

    /**
     * Applies any changes made to the bind group's properties, for a bind group whose owner assigns
     * its slots instead of them being taken from the scope. The owner is expected to have assigned
     * every slot of the format; the resources they hold are re-checked here, as they can change
     * without the owner re-assigning them. Note that the content of used uniform buffers needs to
     * be updated before calling this method.
     */
    commit() {
        this._revalidate();
        this._finalize();
    }

    /**
     * Assigns every slot of the format the value the scope currently holds for it.
     *
     * @private
     */
    _assignFromScope() {

        const { textureFormats, storageTextureFormats, storageBufferFormats } = this.format;

        for (let i = 0; i < textureFormats.length; i++) {
            const textureFormat = textureFormats[i];
            const value = textureFormat.scopeId.value;
            this.setTextureAt(i, value ?? this._substituteTexture(textureFormat));
        }

        for (let i = 0; i < storageTextureFormats.length; i++) {
            const storageTextureFormat = storageTextureFormats[i];
            const value = storageTextureFormat.scopeId.value;
            Debug.assert(value, `Value was not set when assigning storage texture slot [${storageTextureFormat.name}] to a bind group, while rendering [${DebugGraphics.toString()}]`, this);
            this.setStorageTextureAt(i, value);
        }

        for (let i = 0; i < storageBufferFormats.length; i++) {
            const storageBufferFormat = storageBufferFormats[i];
            const value = storageBufferFormat.scopeId.value;
            Debug.assert(value, `Value was not set when assigning storage buffer slot [${storageBufferFormat.name}] to a bind group, while rendering [${DebugGraphics.toString()}]`, this);
            this.setStorageBufferAt(i, value);
        }
    }

    /**
     * The texture to bind for a slot with no value, which is an error - a substitute keeps the
     * rendering going instead of failing on an unset binding, and reports the mistake.
     *
     * @param {BindTextureFormat} textureFormat - The format of the slot.
     * @returns {Texture} The texture to bind.
     * @private
     */
    _substituteTexture(textureFormat) {

        Debug.call(() => {
            const name = textureFormat.name;
            if (name === 'uSceneDepthMap') {
                Debug.errorOnce(`A uSceneDepthMap texture is used by the shader but a scene depth texture is not available. Use CameraComponent.requestSceneDepthMap / enable Depth Grabpass on the Camera Component / CameraFrame.rendering.sceneDepthMap to enable it. Rendering [${DebugGraphics.toString()}]`);
            } else if (name === 'uSceneColorMap') {
                Debug.errorOnce(`A uSceneColorMap texture is used by the shader but a scene color texture is not available. Use CameraComponent.requestSceneColorMap / enable Color Grabpass on the Camera Component / CameraFrame.rendering.sceneColorMap to enable it. Rendering [${DebugGraphics.toString()}]`);
            } else {
                Debug.errorOnce(`Texture ${name} is required for rendering but was not set. Rendering [${DebugGraphics.toString()}]`);
            }
        });

        return this.device.builtInTextures[textureFormat.substituteTexture];
    }

    /**
     * Re-checks the resources the slots already hold. A texture's properties can change, and its
     * GPU resource can be recreated (by a resize, for example), without the slot being assigned
     * again - which the assignment path detects as it goes, and this path has to look for.
     *
     * @private
     */
    _revalidate() {

        const { textures, storageTextures } = this;

        for (let i = 0; i < textures.length; i++) {
            const value = textures[i];
            if (value) {
                const texture = value instanceof TextureView ? value.texture : value;
                if (this.renderVersionUpdated < texture.renderVersionDirty || this._textureImpls[i] !== texture.impl) {
                    this._textureImpls[i] = texture.impl;
                    this.dirty = true;
                }
            }
        }

        for (let i = 0; i < storageTextures.length; i++) {
            const value = storageTextures[i];
            if (value) {
                const texture = value instanceof TextureView ? value.texture : value;
                if (this.renderVersionUpdated < texture.renderVersionDirty || this._storageTextureImpls[i] !== texture.impl) {
                    this._storageTextureImpls[i] = texture.impl;
                    this.dirty = true;
                }
            }
        }
    }

    /**
     * Refreshes the offsets of the uniform buffers, and rebuilds the GPU bind group if anything
     * about the bind group has changed.
     *
     * @private
     */
    _finalize() {

        // update uniform buffer offsets
        for (let i = 0; i < this.uniformBuffers.length; i++) {
            const uniformBuffer = this.uniformBuffers[i];

            // offset
            this.uniformBufferOffsets[i] = uniformBuffer.offset;

            // a non-persistent uniform buffer can be re-allocated into a different dynamic buffer,
            // possibly several times per frame (e.g. XR multiview re-bakes the bind groups per
            // view); rebuild the bind group whenever it moves. Persistent buffers never move.
            if (!uniformBuffer.persistent) {
                const container = uniformBuffer.allocation.gpuBuffer;
                if (this._uniformBufferContainers[i] !== container) {
                    this._uniformBufferContainers[i] = container;
                    this.dirty = true;
                }
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
