import { Debug } from '../../core/debug.js';
import {
    uniformTypeToName,
    UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_BOOL, UNIFORMTYPE_VEC2,
    UNIFORMTYPE_VEC3, UNIFORMTYPE_UINT, UNIFORMTYPE_UVEC3, UNIFORMTYPE_UVEC4,
    UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4,
    UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY,
    UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_UVEC2, UNIFORMTYPE_IVEC2ARRAY, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_UVEC2ARRAY, UNIFORMTYPE_UVEC3ARRAY, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_VEC4ARRAY, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC4, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_BVEC3ARRAY, UNIFORMTYPE_BVEC4ARRAY
} from './constants.js';
import { DynamicBufferAllocation } from './dynamic-buffers.js';

function updateSingleElement(uniformBuffer, value, offset, numComponents) {
    const dst = uniformBuffer.getStorageForType(value.type);
    for (let i = 0; i < numComponents; i++) {
        dst[offset + i] = value[i];
    }
}

function updateArray(uniformBuffer, value, offset, numComponents, count) {
    const dst = uniformBuffer.getStorageForType(value.type);
    for (let i = 0; i < count; i++) {
        for (let j = 0; j < numComponents; j++) {
            dst[offset + i * numComponents + j] = value[i * numComponents + j];
        }
    }
}

// Uniform buffer set functions - only implemented for types for which the default
// array to buffer copy does not work, or could be slower.
const _updateFunctions = [];
// convert from continuous array to vec2[3] with padding to vec4[2]
_updateFunctions[UNIFORMTYPE_MAT2] = (uniformBuffer, value, offset) => {
    const dst = uniformBuffer.storageFloat32;
    dst[offset] = value[0];
    dst[offset + 1] = value[1];

    dst[offset + 4] = value[2];
    dst[offset + 5] = value[3];

    dst[offset + 8] = value[4];
    dst[offset + 9] = value[5];
};

// convert from continuous array to vec3[3] with padding to vec4[3]
_updateFunctions[UNIFORMTYPE_MAT3] = (uniformBuffer, value, offset) => {
    const dst = uniformBuffer.storageFloat32;
    dst[offset] = value[0];
    dst[offset + 1] = value[1];
    dst[offset + 2] = value[2];

    dst[offset + 4] = value[3];
    dst[offset + 5] = value[4];
    dst[offset + 6] = value[5];

    dst[offset + 8] = value[6];
    dst[offset + 9] = value[7];
    dst[offset + 10] = value[8];
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

    /** @type {Float32Array} */
    storageFloat32;

    /** @type {Int32Array} */
    storageInt32;

    /** @type {Uint32Array} */
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

            const updateFunction = _updateFunctions[uniformFormat.updateType];
            if (updateFunction) {
                updateFunction(this, value, offset, uniformFormat.numComponents, uniformFormat.count);
            } else {
                if (uniformFormat.isArrayType) {
                    updateArray(this, value, offset, uniformFormat.numComponents, uniformFormat.count);
                } else {
                    updateSingleElement(this, value, offset, uniformFormat.numComponents);
                }
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
            this.storageFloat32 = null;
            this.storageInt32 = null;
            this.storageUint32 = null;
        }
    }

    getStorageForType(type) {
        switch (type) {
            case UNIFORMTYPE_INT:
            case UNIFORMTYPE_BOOL:
            case UNIFORMTYPE_IVEC2:
            case UNIFORMTYPE_IVEC3:
            case UNIFORMTYPE_IVEC4:
            case UNIFORMTYPE_BVEC2:
            case UNIFORMTYPE_BVEC3:
            case UNIFORMTYPE_BVEC4:
            case UNIFORMTYPE_IVEC2ARRAY:
            case UNIFORMTYPE_IVEC3ARRAY:
            case UNIFORMTYPE_IVEC4ARRAY:
            case UNIFORMTYPE_BVEC2ARRAY:
            case UNIFORMTYPE_BVEC3ARRAY:
            case UNIFORMTYPE_BVEC4ARRAY:
                return this.storageInt32;
            case UNIFORMTYPE_UINT:
            case UNIFORMTYPE_UVEC2:
            case UNIFORMTYPE_UVEC3:
            case UNIFORMTYPE_UVEC4:
            case UNIFORMTYPE_UVEC2ARRAY:
            case UNIFORMTYPE_UVEC3ARRAY:
            case UNIFORMTYPE_UVEC4ARRAY:
                return this.storageUint32;
            case UNIFORMTYPE_FLOAT:
            case UNIFORMTYPE_VEC2:
            case UNIFORMTYPE_VEC3:
            case UNIFORMTYPE_VEC4:
            case UNIFORMTYPE_MAT2:
            case UNIFORMTYPE_MAT3:
            case UNIFORMTYPE_FLOATARRAY:
            case UNIFORMTYPE_VEC2ARRAY:
            case UNIFORMTYPE_VEC3ARRAY:
            case UNIFORMTYPE_VEC4ARRAY:
                return this.storageFloat32;
        }
    }
}

export { UniformBuffer };
