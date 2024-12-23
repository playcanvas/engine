import { FUNC_ALWAYS, STENCILOP_KEEP } from './constants.js';
import { StringIds } from '../../core/string-ids.js';

const stringIds = new StringIds();

/**
 * Holds stencil test settings.
 *
 * @category Graphics
 */
class StencilParameters {
    /**
     * @type {number}
     * @private
     */
    _func;

    /**
     * @type {number}
     * @private
     */
    _ref;

    /**
     * @type {number}
     * @private
     */
    _fail;

    /**
     * @type {number}
     * @private
     */
    _zfail;

    /**
     * @type {number}
     * @private
     */
    _zpass;

    /**
     * @type {number}
     * @private
     */
    _readMask;

    /**
     * @type {number}
     * @private
     */
    _writeMask;

    /**
     * @type {boolean}
     * @private
     */
    _dirty = true;

    /**
     * @type {number}
     * @private
     */
    _key;

    /**
     * Sets the comparison function that decides if the pixel should be written, based on the
     * current stencil buffer value, reference value, and mask value. Can be:
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
    set func(value) {
        this._func = value;
        this._dirty = true;
    }

    /**
     * Sets the comparison function that decides if the pixel should be written.
     *
     * @type {number}
     */
    get func() {
        return this._func;
    }

    /**
     * Sets the stencil test reference value used in comparisons.
     *
     * @type {number}
     */
    set ref(value) {
        this._ref = value;
        this._dirty = true;
    }

    /**
     * Gets the stencil test reference value used in comparisons.
     *
     * @type {number}
     */
    get ref() {
        return this._ref;
    }

    /**
     * Sets the operation to perform if stencil test is failed. Can be:
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
    set fail(value) {
        this._fail = value;
        this._dirty = true;
    }

    /**
     * Gets the operation to perform if stencil test is failed.
     *
     * @type {number}
     */
    get fail() {
        return this._fail;
    }

    /**
     * Sets the operation to perform if depth test is failed. Accepts the same values as `fail`.
     *
     * @type {number}
     */
    set zfail(value) {
        this._zfail = value;
        this._dirty = true;
    }

    /**
     * Gets the operation to perform if depth test is failed.
     *
     * @type {number}
     */
    get zfail() {
        return this._zfail;
    }

    /**
     * Sets the operation to perform if both stencil and depth test are passed. Accepts the same
     * values as `fail`.
     *
     * @type {number}
     */
    set zpass(value) {
        this._zpass = value;
        this._dirty = true;
    }

    /**
     * Gets the operation to perform if both stencil and depth test are passed.
     *
     * @type {number}
     */
    get zpass() {
        return this._zpass;
    }

    /**
     * Sets the mask applied to stencil buffer value and reference value before comparison.
     *
     * @type {number}
     */
    set readMask(value) {
        this._readMask = value;
        this._dirty = true;
    }

    /**
     * Gets the mask applied to stencil buffer value and reference value before comparison.
     *
     * @type {number}
     */
    get readMask() {
        return this._readMask;
    }

    /**
     * Sets the bit mask applied to the stencil value when written.
     *
     * @type {number}
     */
    set writeMask(value) {
        this._writeMask = value;
        this._dirty = true;
    }

    /**
     * Gets the bit mask applied to the stencil value when written.
     *
     * @type {number}
     */
    get writeMask() {
        return this._writeMask;
    }

    /**
     * Create a new StencilParameters instance.
     *
     * @param {object} [options] - Options object to configure the stencil parameters.
     */
    constructor(options = {}) {
        this._func = options.func ?? FUNC_ALWAYS;
        this._ref = options.ref ?? 0;
        this._readMask = options.readMask ?? 0xFF;
        this._writeMask = options.writeMask ?? 0xFF;

        this._fail = options.fail ?? STENCILOP_KEEP; // keep == 0
        this._zfail = options.zfail ?? STENCILOP_KEEP;
        this._zpass = options.zpass ?? STENCILOP_KEEP;

        // Evaluate key here. This evaluates the key for the DEFAULT instance, which is important,
        // as during rendering it gets copied and the key would get evaluated each time.
        this._evalKey();
    }

    _evalKey() {
        const { _func, _ref, _fail, _zfail, _zpass, _readMask, _writeMask } = this;
        const key = `${_func},${_ref},${_fail},${_zfail},${_zpass},${_readMask},${_writeMask}`;
        this._key = stringIds.get(key);
        this._dirty = false;
    }

    get key() {
        if (this._dirty) {
            this._evalKey();
        }
        return this._key;
    }

    /**
     * Copies the contents of a source stencil parameters to this stencil parameters.
     *
     * @param {StencilParameters} rhs - A stencil parameters to copy from.
     * @returns {StencilParameters} Self for chaining.
     */
    copy(rhs) {
        this._func = rhs._func;
        this._ref = rhs._ref;
        this._readMask = rhs._readMask;
        this._writeMask = rhs._writeMask;
        this._fail = rhs._fail;
        this._zfail = rhs._zfail;
        this._zpass = rhs._zpass;
        this._dirty = rhs._dirty;
        this._key = rhs._key;
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
