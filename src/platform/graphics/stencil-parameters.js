import { FUNC_ALWAYS, STENCILOP_KEEP } from './constants.js';

/**
 * Holds stencil test settings.
 */
class StencilParameters {
    /**
     * A comparison function that decides if the pixel should be written, based on the current
     * stencil buffer value, reference value, and mask value. Can be:
     *
     * - {@link FUNC_NEVER}: never pass
     * - {@link FUNC_LESS}: pass if (ref & mask) < (stencil & mask)
     * - {@link FUNC_EQUAL}: pass if (ref & mask) == (stencil & mask)
     * - {@link FUNC_LESSEQUAL}: pass if (ref & mask) <= (stencil & mask)
     * - {@link FUNC_GREATER}: pass if (ref & mask) > (stencil & mask)
     * - {@link FUNC_NOTEQUAL}: pass if (ref & mask) != (stencil & mask)
     * - {@link FUNC_GREATEREQUAL}: pass if (ref & mask) >= (stencil & mask)
     * - {@link FUNC_ALWAYS}: always pass
     *
     * @type {number}
     */
    func;

    /**
     * Sets stencil test reference value used in comparisons.
     *
     * @type {number}
     */
    ref;

    /**
     * Operation to perform if stencil test is failed. Can be:
     *
     * - {@link STENCILOP_KEEP}: don't change the stencil buffer value
     * - {@link STENCILOP_ZERO}: set value to zero
     * - {@link STENCILOP_REPLACE}: replace value with the reference value.
     * - {@link STENCILOP_INCREMENT}: increment the value
     * - {@link STENCILOP_INCREMENTWRAP}: increment the value, but wrap it to zero when it's larger
     * than a maximum representable value
     * - {@link STENCILOP_DECREMENT}: decrement the value
     * - {@link STENCILOP_DECREMENTWRAP}: decrement the value, but wrap it to a maximum
     * representable value, if the current value is 0
     * - {@link STENCILOP_INVERT}: invert the value bitwise
     *
     * @type {number}
     */
    fail;

    /**
     * Operation to perform if depth test is failed. Accepts the same values as `fail`.
     *
     * @type {number}
     */
    zfail;

    /**
     * Operation to perform if both stencil and depth test are passed. Accepts the same values as
     * `fail`.
     *
     * @type {number}
     */
    zpass;

    /**
     * Mask applied to stencil buffer value and reference value before comparison.
     *
     * @type {number}
     */
    readMask;

    /**
     * A bit mask applied to the stencil value, when written.
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
