import { Debug } from '../../core/debug.js';
import {
    uniformTypeToName,
    UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, uniformTypeToStorage, TYPE_INT32, TYPE_FLOAT32, TYPE_UINT32
} from './constants.js';
import { DynamicBufferAllocation } from './dynamic-buffers.js';

function set(dst, value, offset, numComponents, stride = numComponents) {
    for (let i = 0; i < numComponents; i++) {
        dst[offset + i * stride] = value[i];
    }
}

function setArray(dst, value, offset, numComponents, count, componentStride = numComponents, arrayStride = componentStride) {
    for (let i = 0; i < count; i++) {
        for (let j = 0; j < numComponents; j++) {
            dst[offset + i * arrayStride + j] = value[i * componentStride + j];
        }
    }
}

// Uniform buffer set functions - only implemented for types for which the default
// array to buffer copy does not work, or could be slower.
const _updateFunctions = [];
// convert from continuous array to vec2[3] with padding to vec4[2]
_updateFunctions[UNIFORMTYPE_MAT2] = (uniformBuffer, value, offset) => {
    setArray(uniformBuffer.storageFloat32, value, offset, 2, 2, 2, 4);
};

// convert from continuous array to vec3[3] with padding to vec4[3]
_updateFunctions[UNIFORMTYPE_MAT3] = (uniformBuffer, value, offset) => {
    setArray(uniformBuffer.storageFloat32, value, offset, 3, 3, 3, 4);
};

/**
 * A uniform buffer represents a GPU memory buffer storing the uniforms.
 *
 * @ignore
 */
class UniformBuffer {
    device;

    /** @type {boolean} */
    persistent;

    /** @type {DynamicBufferAllocation} */
    allocation;

    /** @type {Float32Array | undefined} */
    storageFloat32;

    /** @type {Int32Array | undefined} */
    storageInt32;

    /** @type {Uint32Array | undefined} */
    storageUint32;

    /**
     * A render version used to track the last time the properties requiring bind group to be
     * updated were changed.
     *
     * @type {number}
     */
    renderVersionDirty = 0;

    /**
     * Create a new UniformBuffer instance.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this uniform buffer.
     * @param {import('./uniform-buffer-format.js').UniformBufferFormat} format - Format of the
     * uniform buffer.
     * @param {boolean} [persistent] - Whether the buffer is persistent. Defaults to true.
     */
    constructor(graphicsDevice, format, persistent = true) {
        this.device = graphicsDevice;
        this.format = format;
        this.persistent = persistent;
        Debug.assert(format);

        if (persistent) {

            this.impl = graphicsDevice.createUniformBufferImpl(this);

            const storage = new ArrayBuffer(format.byteSize);
            this.assignStorage(new Int32Array(storage));

            graphicsDevice._vram.ub += this.format.byteSize;

            // TODO: register with the device and handle lost context
            // this.device.buffers.push(this);
        } else {

            this.allocation = new DynamicBufferAllocation();
        }
    }

    /**
     * Frees resources associated with this uniform buffer.
     */
    destroy() {

        if (this.persistent) {
            // stop tracking the vertex buffer
            // TODO: remove the buffer from the list on the device (lost context handling)
            const device = this.device;

            this.impl.destroy(device);

            device._vram.ub -= this.format.byteSize;
        }
    }

    get offset() {
        return this.persistent ? 0 : this.allocation.offset;
    }

    /**
     * Assign a storage to this uniform buffer.
     *
     * @param {Int32Array} storage - The storage to assign to this uniform buffer.
     */
    assignStorage(storage) {
        this.storageInt32 = storage;
        this.storageUint32 = new Uint32Array(storage.buffer, storage.byteOffset, storage.byteLength / 4);
        this.storageFloat32 = new Float32Array(storage.buffer, storage.byteOffset, storage.byteLength / 4);
    }

    /**
     * Called when the rendering context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        this.impl?.loseContext();
    }

    /**
     * Assign a value to the uniform specified by its format. This is the fast version of assigning
     * a value to a uniform, avoiding any lookups.
     *
     * @param {import('./uniform-buffer-format.js').UniformFormat} uniformFormat - The format of
     * the uniform.
     */
    setUniform(uniformFormat) {
        Debug.assert(uniformFormat);
        const offset = uniformFormat.offset;
        const value = uniformFormat.scopeId.value;

        if (value !== null && value !== undefined) {
            const storageType = uniformTypeToStorage[uniformFormat.type];
            const dst = storageType === TYPE_INT32 ? this.storageInt32 :
                storageType === TYPE_UINT32 ? this.storageUint32 : this.storageFloat32;

            if (!dst) {
                Debug.error(`Uniform buffer storage is not allocated for type ${uniformTypeToName[uniformFormat.type]}`);
                return;
            }

            const updateFunction = _updateFunctions[uniformFormat.updateType];
            if (updateFunction) {
                updateFunction(this, value, offset, uniformFormat.numComponents, uniformFormat.count);
            } else if (uniformFormat.isArrayType) {
                setArray(dst, value, offset, uniformFormat.numComponents, uniformFormat.count);
            } else {
                set(dst, value, offset, uniformFormat.numComponents);
            }
        } else {
            Debug.warnOnce(`Value was not set when assigning to uniform [${uniformFormat.name}]` +
                            `, expected type ${uniformTypeToName[uniformFormat.type]}`);
        }
    }

    /**
     * Assign a value to the uniform specified by name.
     *
     * @param {string} name - The name of the uniform.
     */
    set(name) {
        const uniformFormat = this.format.map.get(name);
        Debug.assert(uniformFormat, `Uniform name [${name}] is not part of the Uniform buffer.`);
        if (uniformFormat) {
            this.setUniform(uniformFormat);
        }
    }

    update() {

        const persistent = this.persistent;
        if (!persistent) {

            // allocate memory from dynamic buffer for this frame
            const allocation = this.allocation;
            const oldGpuBuffer = allocation.gpuBuffer;
            this.device.dynamicBuffers.alloc(allocation, this.format.byteSize);
            this.assignStorage(allocation.storage);

            // buffer has changed, update the render version to force bind group to be updated
            if (oldGpuBuffer !== allocation.gpuBuffer) {
                this.renderVersionDirty = this.device.renderVersion;
            }
        }

        // set new values
        const uniforms = this.format.uniforms;
        for (let i = 0; i < uniforms.length; i++) {
            this.setUniform(uniforms[i]);
        }

        if (persistent) {
            // Upload the new data
            this.impl.unlock(this);
        } else {
            this.storageFloat32 = undefined;
            this.storageInt32 = undefined;
            this.storageUint32 = undefined;
        }
    }
}

export { UniformBuffer };
