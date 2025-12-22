/**
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { IndexBuffer } from './index-buffer.js'
 * @import { ScopeId } from './scope-id.js'
 * @import { Shader } from './shader.js'
 * @import { StorageBuffer } from './storage-buffer.js'
 * @import { Texture } from './texture.js'
 * @import { TextureView } from './texture-view.js'
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
    }
}

export { Compute };
