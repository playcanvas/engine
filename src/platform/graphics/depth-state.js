import { BitPacking } from "../../core/math/bit-packing.js";
import { StringIds } from "../../core/string-ids.js";
import {
    FUNC_LESSEQUAL, FUNC_ALWAYS
} from './constants.js';

const stringIds = new StringIds();

// masks (to only keep relevant bits)
const funcMask = 0b111;

// shifts values to where individual parts are stored
const funcShift = 0;       // 00 - 02 (3bits)
const writeShift = 3;      // 03 - 03 (1bit)

/**
 * DepthState is a descriptor that defines how the depth value of the fragment is used by the
 * rendering pipeline. A depth state can be set on a material using {@link Material#depthState},
 * or in some cases on the graphics device using {@link GraphicsDevice#setDepthState}.
 *
 * For the best performance, do not modify depth state after it has been created, but create
 * multiple depth states and assign them to the material or graphics device as needed.
 *
 * @category Graphics
 */
class DepthState {
    /**
     * Bit field representing the depth state.
     *
     * @private
     */
    data = 0;

    _depthBias = 0;

    _depthBiasSlope = 0;

    /**
     * A unique number representing the depth state. You can use this number to quickly compare
     * two depth states for equality. The key is always maintained valid without a dirty flag,
     * to avoid condition check at runtime, considering these change rarely.
     *
     * @type {number}
     */
    key = 0;

    /**
     * Create a new Depth State instance.
     *
     * @param {number} func - Controls how the depth of the fragment is compared against the
     * current depth contained in the depth buffer. See {@link DepthState#func} for details.
     * Defaults to {@link FUNC_LESSEQUAL}.
     * @param {boolean} write - If true, depth values are written to the depth buffer of the
     * currently active render target. Defaults to true.
     */
    constructor(func = FUNC_LESSEQUAL, write = true) {
        this.func = func;
        this.write = write;
    }

    /**
     * Sets whether depth testing is performed. If true, a shader fragment is only written to the
     * current render target if it passes the depth test. If false, it is written regardless of
     * what is in the depth buffer. Note that when depth testing is disabled, writes to the depth
     * buffer are also disabled. Defaults to true.
     *
     * @type {boolean}
     */
    set test(value) {
        this.func = value ? FUNC_LESSEQUAL : FUNC_ALWAYS;
        this.updateKey();
    }

    /**
     * Gets whether depth testing is performed.
     *
     * @type {boolean}
     */
    get test() {
        return this.func !== FUNC_ALWAYS;
    }

    /**
     * Sets whether depth writing is performed. If true, shader write a depth value to the depth
     * buffer of the currently active render target. If false, no depth value is written.
     *
     * @type {boolean}
     */
    set write(value) {
        this.data = BitPacking.set(this.data, value ? 1 : 0, writeShift);
        this.updateKey();
    }

    /**
     * Gets whether depth writing is performed.
     *
     * @type {boolean}
     */
    get write() {
        return BitPacking.all(this.data, writeShift);
    }

    /**
     * Sets the depth testing function. Controls how the depth of the fragment is compared against
     * the current depth contained in the depth buffer. Can be:
     *
     * - {@link FUNC_NEVER}: don't draw
     * - {@link FUNC_LESS}: draw if new depth < depth buffer
     * - {@link FUNC_EQUAL}: draw if new depth == depth buffer
     * - {@link FUNC_LESSEQUAL}: draw if new depth <= depth buffer
     * - {@link FUNC_GREATER}: draw if new depth > depth buffer
     * - {@link FUNC_NOTEQUAL}: draw if new depth != depth buffer
     * - {@link FUNC_GREATEREQUAL}: draw if new depth >= depth buffer
     * - {@link FUNC_ALWAYS}: always draw
     *
     * @type {number}
     */
    set func(value) {
        this.data = BitPacking.set(this.data, value, funcShift, funcMask);
        this.updateKey();
    }

    /**
     * Gets the depth testing function.
     *
     * @type {number}
     */
    get func() {
        return BitPacking.get(this.data, funcShift, funcMask);
    }

    /**
     * Sets the constant depth bias added to each fragment's depth. Useful for decals to prevent
     * z-fighting. Typically a small negative value (-0.1) is used to render the mesh slightly
     * closer to the camera. Defaults to 0.
     *
     * @type {number}
     */
    set depthBias(value) {
        this._depthBias = value;
        this.updateKey();
    }

    /**
     * Gets the constant depth bias added to each fragment's depth.
     *
     * @type {number}
     */
    get depthBias() {
        return this._depthBias;
    }

    /**
     * Sets the depth bias that scales with the fragment's slope. Defaults to 0.
     *
     * @type {number}
     */
    set depthBiasSlope(value) {
        this._depthBiasSlope = value;
        this.updateKey();
    }

    /**
     * Gets the depth bias that scales with the fragment's slope.
     *
     * @type {number}
     */
    get depthBiasSlope() {
        return this._depthBiasSlope;
    }

    /**
     * Copies the contents of a source depth state to this depth state.
     *
     * @param {DepthState} rhs - A depth state to copy from.
     * @returns {DepthState} Self for chaining.
     */
    copy(rhs) {
        this.data = rhs.data;
        this._depthBias = rhs._depthBias;
        this._depthBiasSlope = rhs._depthBiasSlope;
        this.key = rhs.key;
        return this;
    }

    /**
     * Returns an identical copy of the specified depth state.
     *
     * @returns {this} The result of the cloning.
     */
    clone() {
        const clone = new this.constructor();
        return clone.copy(this);
    }

    updateKey() {
        const { data, _depthBias, _depthBiasSlope } = this;
        const key = `${data}-${_depthBias}-${_depthBiasSlope}`;

        // convert string to a unique number
        this.key = stringIds.get(key);
    }

    /**
     * Reports whether two DepthStates are equal.
     *
     * @param {DepthState} rhs - The depth state to compare to.
     * @returns {boolean} True if the depth states are equal and false otherwise.
     */
    equals(rhs) {
        return this.key === rhs.key;
    }

    /**
     * A default depth state that has the depth testing function set to {@link FUNC_LESSEQUAL} and
     * depth writes enabled.
     *
     * @type {DepthState}
     * @readonly
     */
    static DEFAULT = Object.freeze(new DepthState());

    /**
     * A depth state that always passes the fragment but does not write depth to the depth buffer.
     *
     * @type {DepthState}
     * @readonly
     */
    static NODEPTH = Object.freeze(new DepthState(FUNC_ALWAYS, false));

    /**
     * A depth state that always passes the fragment and writes depth to the depth buffer.
     *
     * @type {DepthState}
     * @readonly
     */
    static WRITEDEPTH = Object.freeze(new DepthState(FUNC_ALWAYS, true));
}

export { DepthState };
