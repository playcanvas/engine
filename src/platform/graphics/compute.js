/**
 * A helper class storing a parameter value as well as its scope ID.
 *
 * @ignore
 */
class ComputeParameter {
    value;

    /** @type {import('./scope-id.js').ScopeId} */
    scopeId = null;
}

/**
 * A representation of a compute shader with the associated data, that can be executed on the GPU.
 *
 * @ignore
 */
class Compute {
    /**
     * A compute shader.
     *
     * @type {import('./shader.js').Shader|null}
     * @ignore
     */
    shader = null;

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
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice -
     * The graphics device.
     * @param {import('./shader.js').Shader} shader - The compute shader.
     */
    constructor(graphicsDevice, shader) {
        this.device = graphicsDevice;
        this.shader = shader;

        if (graphicsDevice.supportsCompute) {
            this.impl = graphicsDevice.createComputeImpl(this);
        }
    }

    /**
     * Sets a shader parameter on a compute instance.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|Float32Array|import('./texture.js').Texture} value - The value for
     * the specified parameter.
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
     * @returns {number|number[]|Float32Array|import('./texture.js').Texture|undefined} The value of the
     * specified parameter.
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
