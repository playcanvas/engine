import { Debug } from '../../core/debug.js';
import {
    uniformTypeToName,
    UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3,
    UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4,
    UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY,
    UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3
} from './constants.js';
import { DynamicBufferAllocation } from './dynamic-buffers.js';

// Uniform buffer set functions - only implemented for types for which the default
// array to buffer copy does not work, or could be slower.
const _updateFunctions = [];

_updateFunctions[UNIFORMTYPE_FLOAT] = function (uniformBuffer, value, offset) {
    const dst = uniformBuffer.storageFloat32;
    dst[offset] = value;
};

_updateFunctions[UNIFORMTYPE_VEC2] = (uniformBuffer, value, offset) => {
    const dst = uniformBuffer.storageFloat32;
    dst[offset] = value[0];
    dst[offset + 1] = value[1];
};

_updateFunctions[UNIFORMTYPE_VEC3] = (uniformBuffer, value, offset) => {
    const dst = uniformBuffer.storageFloat32;
    dst[offset] = value[0];
    dst[offset + 1] = value[1];
    dst[offset + 2] = value[2];
};

_updateFunctions[UNIFORMTYPE_VEC4] = (uniformBuffer, value, offset) => {
    const dst = uniformBuffer.storageFloat32;
    dst[offset] = value[0];
    dst[offset + 1] = value[1];
    dst[offset + 2] = value[2];
    dst[offset + 3] = value[3];
};

_updateFunctions[UNIFORMTYPE_INT] = function (uniformBuffer, value, offset) {
    const dst = uniformBuffer.storageInt32;
    dst[offset] = value;
};

_updateFunctions[UNIFORMTYPE_IVEC2] = function (uniformBuffer, value, offset) {
    const dst = uniformBuffer.storageInt32;
    dst[offset] = value[0];
    dst[offset + 1] = value[1];
};

_updateFunctions[UNIFORMTYPE_IVEC3] = function (uniformBuffer, value, offset) {
    const dst = uniformBuffer.storageInt32;
    dst[offset] = value[0];
    dst[offset + 1] = value[1];
    dst[offset + 2] = value[2];
};

_updateFunctions[UNIFORMTYPE_IVEC4] = function (uniformBuffer, value, offset) {
    const dst = uniformBuffer.storageInt32;
    dst[offset] = value[0];
    dst[offset + 1] = value[1];
    dst[offset + 2] = value[2];
    dst[offset + 3] = value[3];
};

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

_updateFunctions[UNIFORMTYPE_FLOATARRAY] = function (uniformBuffer, value, offset, count) {
    const dst = uniformBuffer.storageFloat32;
    for (let i = 0; i < count; i++) {
        dst[offset + i * 4] = value[i];
    }
};

_updateFunctions[UNIFORMTYPE_VEC2ARRAY] = (uniformBuffer, value, offset, count) => {
    const dst = uniformBuffer.storageFloat32;
    for (let i = 0; i < count; i++) {
        dst[offset + i * 4] = value[i * 2];
        dst[offset + i * 4 + 1] = value[i * 2 + 1];
    }
};

_updateFunctions[UNIFORMTYPE_VEC3ARRAY] = (uniformBuffer, value, offset, count) => {
    const dst = uniformBuffer.storageFloat32;
    for (let i = 0; i < count; i++) {
        dst[offset + i * 4] = value[i * 3];
        dst[offset + i * 4 + 1] = value[i * 3 + 1];
        dst[offset + i * 4 + 2] = value[i * 3 + 2];
    }
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
                updateFunction(this, value, offset, uniformFormat.count);
            } else {
                this.storageFloat32.set(value, offset);
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
        }
    }
}

export { UniformBuffer };
