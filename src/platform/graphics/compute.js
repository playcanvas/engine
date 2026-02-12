/**
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { IndexBuffer } from './index-buffer.js'
 * @import { ScopeId } from './scope-id.js'
 * @import { Shader } from './shader.js'
 * @import { StorageBuffer } from './storage-buffer.js'
 * @import { Texture } from './texture.js'
 * @import { TextureView } from './texture-view.js'
 * @import { Vec2 } from '../../core/math/vec2.js'
 * @import { VertexBuffer } from './vertex-buffer.js'
 */

/**
 * A helper class storing a parameter value as well as its scope ID.
 *
 * @ignore
 */
class ComputeParameter {
    value;

    /** @type {ScopeId} */
    scopeId = null;
}

/**
 * A representation of a compute shader with the associated resources, that can be executed on the
 * GPU. Only supported on WebGPU platform.
 */
class Compute {
    /**
     * A compute shader.
     *
     * @type {Shader|null}
     * @ignore
     */
    shader = null;

    /**
     * The non-unique name of an instance of the class. Defaults to 'Unnamed'.
     *
     * @type {string}
     */
    name;

    /**
     * @type {Map<string, ComputeParameter>}
     * @ignore
     */
    parameters = new Map();

    /**
     * @type {number}
     * @ignore
     */
    countX = 1;

    /**
     * @type {number|undefined}
     * @ignore
     */
    countY;

    /**
     * @type {number|undefined}
     * @ignore
     */
    countZ;

    /**
     * Slot index in the indirect dispatch buffer, or -1 for direct dispatch.
     *
     * @type {number}
     * @ignore
     */
    indirectSlotIndex = -1;

    /**
     * Custom buffer for indirect dispatch, or null to use device's built-in buffer.
     *
     * @type {StorageBuffer|null}
     * @ignore
     */
    indirectBuffer = null;

    /**
     * Frame stamp (device.renderVersion) when indirect slot was set. Used for validation
     * when using the built-in buffer.
     *
     * @type {number}
     * @ignore
     */
    indirectFrameStamp = 0;

    /**
     * Create a compute instance. Note that this is supported on WebGPU only and is a no-op on
     * other platforms.
     *
     * @param {GraphicsDevice} graphicsDevice -
     * The graphics device.
     * @param {Shader} shader - The compute shader.
     * @param {string} [name] - The name of the compute instance, used for debugging only.
     */
    constructor(graphicsDevice, shader, name = 'Unnamed') {
        this.device = graphicsDevice;
        this.shader = shader;
        this.name = name;

        if (graphicsDevice.supportsCompute) {
            this.impl = graphicsDevice.createComputeImpl(this);
        }
    }

    /**
     * Sets a shader parameter on a compute instance.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|Float32Array|Texture|StorageBuffer|VertexBuffer|IndexBuffer|TextureView} value -
     * The value for the specified parameter.
     */
    setParameter(name, value) {
        let param = this.parameters.get(name);
        if (!param) {
            param = new ComputeParameter();
            param.scopeId = this.device.scope.resolve(name);
            this.parameters.set(name, param);
        }
        param.value = value;
    }

    /**
     * Returns the value of a shader parameter from the compute instance.
     *
     * @param {string} name - The name of the parameter to get.
     * @returns {number|number[]|Float32Array|Texture|StorageBuffer|VertexBuffer|IndexBuffer|undefined}
     * The value of the specified parameter.
     */
    getParameter(name) {
        return this.parameters.get(name)?.value;
    }

    /**
     * Deletes a shader parameter from the compute instance.
     *
     * @param {string} name - The name of the parameter to delete.
     */
    deleteParameter(name) {
        this.parameters.delete(name);
    }

    /**
     * Apply the parameters to the scope.
     *
     * @ignore
     */
    applyParameters() {
        for (const [, param] of this.parameters) {
            param.scopeId.setValue(param.value);
        }
    }

    /**
     * Prepare the compute work dispatch.
     *
     * @param {number} x - X dimension of the grid of work-groups to dispatch.
     * @param {number} [y] - Y dimension of the grid of work-groups to dispatch.
     * @param {number} [z] - Z dimension of the grid of work-groups to dispatch.
     */
    setupDispatch(x, y, z) {
        this.countX = x;
        this.countY = y;
        this.countZ = z;

        // reset indirect dispatch state
        this.indirectSlotIndex = -1;
        this.indirectBuffer = null;
    }

    /**
     * Prepare the compute work dispatch to use indirect parameters from a buffer. The dispatch
     * parameters (x, y, z workgroup counts) are read from the buffer at the specified slot index.
     *
     * When using the device's built-in buffer (buffer parameter is null), this method must be
     * called each frame as slots are only valid for the current frame.
     *
     * @param {number} slotIndex - Slot index in the indirect dispatch buffer. When using the
     * device's built-in buffer, obtain this by calling {@link GraphicsDevice#getIndirectDispatchSlot}.
     * @param {StorageBuffer|null} [buffer] - Optional custom storage buffer containing dispatch
     * parameters. If not provided, uses the device's built-in {@link GraphicsDevice#indirectDispatchBuffer}.
     * When providing a custom buffer, the user is responsible for its lifetime and contents.
     * @example
     * // Reserve a slot in the indirect dispatch buffer
     * const slot = device.getIndirectDispatchSlot();
     *
     * // First compute shader writes dispatch parameters to the buffer
     * prepareCompute.setParameter('indirectBuffer', device.indirectDispatchBuffer);
     * prepareCompute.setParameter('slot', slot);
     * prepareCompute.setupDispatch(1, 1, 1);
     * device.computeDispatch([prepareCompute]);
     *
     * // Second compute shader uses indirect dispatch
     * processCompute.setupIndirectDispatch(slot);
     * device.computeDispatch([processCompute]);
     */
    setupIndirectDispatch(slotIndex, buffer = null) {
        this.indirectSlotIndex = slotIndex;
        this.indirectBuffer = buffer;
        this.indirectFrameStamp = this.device.renderVersion;
    }

    /**
     * Calculate near-square 2D dispatch dimensions for a given workgroup count,
     * respecting the WebGPU per-dimension limit. When the count fits within a single
     * dimension, Y is 1. Otherwise, dimensions are chosen to be roughly square to
     * minimize wasted padding threads.
     *
     * @param {number} count - Total number of workgroups needed.
     * @param {Vec2} result - Output vector to receive X (x) and Y (y) dimensions.
     * @param {number} [maxDimension=65535] - Maximum workgroups per dimension.
     * @returns {Vec2} The result vector with dimensions set.
     * @ignore
     */
    static calcDispatchSize(count, result, maxDimension = 65535) {
        if (count <= maxDimension) {
            return result.set(count, 1);
        }
        const x = Math.floor(Math.sqrt(count));
        return result.set(x, Math.ceil(count / x));
    }
}

export { Compute };
