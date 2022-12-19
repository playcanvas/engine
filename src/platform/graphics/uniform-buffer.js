import { Debug } from '../../core/debug.js';
import {
    uniformTypeToName,
    UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3,
    UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4,
    UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY,
    UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3
} from './constants.js';

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
    /**
     * Create a new UniformBuffer instance.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used to manage this uniform buffer.
     * @param {import('./uniform-buffer-format.js').UniformBufferFormat} format - Format of the
     * uniform buffer.
     */
    constructor(graphicsDevice, format) {
        this.device = graphicsDevice;
        this.format = format;
        Debug.assert(format);

        this.impl = graphicsDevice.createUniformBufferImpl(this);

        this.storage = new ArrayBuffer(format.byteSize);
        this.storageFloat32 = new Float32Array(this.storage);
        this.storageInt32 = new Int32Array(this.storage);

        graphicsDevice._vram.ub += this.format.byteSize;

        // TODO: register with the device and handle lost context
        // this.device.buffers.push(this);
    }

    /**
     * Frees resources associated with this uniform buffer.
     */
    destroy() {

        // // stop tracking the vertex buffer
        const device = this.device;

        // TODO: remove the buffer from the list on the device (lost context handling)

        this.impl.destroy(device);

        device._vram.ub -= this.format.byteSize;
    }

    /**
     * Called when the rendering context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        this.impl.loseContext();
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

        // set new values
        const uniforms = this.format.uniforms;
        for (let i = 0; i < uniforms.length; i++) {
            this.setUniform(uniforms[i]);
        }

        // Upload the new data
        this.impl.unlock(this);
    }
}

export { UniformBuffer };
