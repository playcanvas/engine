import { Debug } from '../../core/debug.js';
import { TRACEID_BINDGROUP_ALLOC } from '../../core/constants.js';
import { UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';
import { DebugGraphics } from './debug-graphics.js';
import { getBuiltInTexture } from './built-in-textures.js';
import { TextureView } from './texture-view.js';

/**
 * @import { BindGroupFormat } from './bind-group-format.js'
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
     * @private
     */
    renderVersionUpdated = -1;

    /** @type {UniformBuffer[]} */
    uniformBuffers;

    /**
     * An array of offsets for each uniform buffer in the bind group. This is the offset in the
     * buffer where the uniform buffer data starts.
     *
     * @type {number[]}
     */
    uniformBufferOffsets = [];

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
     * Applies any changes made to the bind group's properties. Note that the content of used
     * uniform buffers needs to be updated before calling this method.
     */
    update() {

        // TODO: implement faster version of this, which does not call SetTexture, which does a map lookup
        const { textureFormats, storageTextureFormats, storageBufferFormats } = this.format;

        for (let i = 0; i < textureFormats.length; i++) {
            const textureFormat = textureFormats[i];
            let value = textureFormat.scopeId.value;

            // custom error handling for known global textures
            if (!value) {
                if (textureFormat.name === 'uSceneDepthMap') {
                    Debug.errorOnce(`A uSceneDepthMap texture is used by the shader but a scene depth texture is not available. Use CameraComponent.requestSceneDepthMap / enable Depth Grabpass on the Camera Component / CameraFrame.rendering.sceneDepthMap to enable it. Rendering [${DebugGraphics.toString()}]`);
                    value = getBuiltInTexture(this.device, 'white');
                }
                if (textureFormat.name === 'uSceneColorMap') {
                    Debug.errorOnce(`A uSceneColorMap texture is used by the shader but a scene color texture is not available. Use CameraComponent.requestSceneColorMap / enable Color Grabpass on the Camera Component / CameraFrame.rendering.sceneColorMap to enable it. Rendering [${DebugGraphics.toString()}]`);
                    value = getBuiltInTexture(this.device, 'pink');
                }

                // missing generic texture
                if (!value) {
                    Debug.errorOnce(`Texture ${textureFormat.name} is required for rendering but was not set. Rendering [${DebugGraphics.toString()}]`);
                    value = getBuiltInTexture(this.device, 'pink');
                }
            }

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
