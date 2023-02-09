import { FUNC_ALWAYS, STENCILOP_KEEP } from '../platform/graphics/constants.js';

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
     * @param {object} options - Options object to configure the stencil parameters.
     */
    constructor(options) {
        this.func = options.func ?? FUNC_ALWAYS;
        this.ref = options.ref ?? 0;
        this.readMask = options.readMask ?? 0xFF;
        this.writeMask = options.writeMask ?? 0xFF;

        this.fail = options.fail ?? STENCILOP_KEEP; // keep == 0
        this.zfail = options.zfail ?? STENCILOP_KEEP;
        this.zpass = options.zpass ?? STENCILOP_KEEP;
    }

    /**
     * Clone the stencil parameters.
     *
     * @returns {StencilParameters} A cloned StencilParameters object.
     */
    clone() {
        return new StencilParameters({
            func: this.func,
            ref: this.ref,
            readMask: this.readMask,
            writeMask: this.writeMask,
            fail: this.fail,
            zfail: this.zfail,
            zpass: this.zpass
        });
    }
}

export { StencilParameters };
