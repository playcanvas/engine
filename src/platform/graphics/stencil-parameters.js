import { FUNC_ALWAYS, STENCILOP_KEEP } from './constants.js';

/**
 * Holds stencil test settings.
 */
class StencilParameters {
    /**
     * Sets stencil test function. See {@link GraphicsDevice#setStencilFunc}.
     *
     * @type {number}
     */
    func;

    /**
     * Sets stencil test reference value. See {@link GraphicsDevice#setStencilFunc}.
     *
     * @type {number}
     */
    ref;

    /**
     * Sets operation to perform if stencil test is failed. See {@link GraphicsDevice#setStencilOperation}.
     *
     * @type {number}
     */
    fail;

    /**
     * Sets operation to perform if depth test is failed. See {@link GraphicsDevice#setStencilOperation}.
     *
     * @type {number}
     */
    zfail;

    /**
     * Sets operation to perform if both stencil and depth test are passed. See {@link GraphicsDevice#setStencilOperation}.
     *
     * @type {number}
     */
    zpass;

    /**
     * Sets stencil test reading mask. See {@link GraphicsDevice#setStencilFunc}.
     *
     * @type {number}
     */
    readMask;

    /**
     * Sets stencil test writing mask. See {@link GraphicsDevice#setStencilOperation}.
     *
     * @type {number}
     */
    writeMask;

    /**
     * Create a new StencilParameters instance.
     *
     * @param {object} [options] - Options object to configure the stencil parameters.
     */
    constructor(options = {}) {
        this.func = options.func ?? FUNC_ALWAYS;
        this.ref = options.ref ?? 0;
        this.readMask = options.readMask ?? 0xFF;
        this.writeMask = options.writeMask ?? 0xFF;

        this.fail = options.fail ?? STENCILOP_KEEP; // keep == 0
        this.zfail = options.zfail ?? STENCILOP_KEEP;
        this.zpass = options.zpass ?? STENCILOP_KEEP;
    }

    // TODO: we could store the key as a property and only update it when the parameters change,
    // by using a dirty flag. But considering stencil is used rarely, this can be done at a later
    // stage. This function is only called when the stencil state is enabled. We could also use
    // BitField to store the parameters and to speed up the key generation.
    get key() {
        const { func, ref, fail, zfail, zpass, readMask, writeMask } = this;
        return `${func},${ref},${fail},${zfail},${zpass},${readMask},${writeMask}`;
    }

    /**
     * Copies the contents of a source stencil parameters to this stencil parameters.
     *
     * @param {StencilParameters} rhs - A stencil parameters to copy from.
     * @returns {StencilParameters} Self for chaining.
     */
    copy(rhs) {
        this.func = rhs.func;
        this.ref = rhs.ref;
        this.readMask = rhs.readMask;
        this.writeMask = rhs.writeMask;
        this.fail = rhs.fail;
        this.zfail = rhs.zfail;
        this.zpass = rhs.zpass;
        return this;
    }

    /**
     * Clone the stencil parameters.
     *
     * @returns {StencilParameters} A cloned StencilParameters object.
     */
    clone() {
        const clone = new this.constructor();
        return clone.copy(this);
    }

    /**
     * A default stencil state.
     *
     * @type {StencilParameters}
     * @readonly
     */
    static DEFAULT = Object.freeze(new StencilParameters());
}

export { StencilParameters };
