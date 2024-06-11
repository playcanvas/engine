import { BitPacking } from "../../core/math/bit-packing.js";
import { BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ZERO, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA } from '../../platform/graphics/constants.js';

// masks (to only keep relevant bits)
const opMask = 0b111;
const factorMask = 0b1111;

// shifts values to where individual parts are stored
const colorOpShift = 0;             // 00 - 02 (3bits)
const colorSrcFactorShift = 3;      // 03 - 06 (4bits)
const colorDstFactorShift = 7;      // 07 - 10 (4bits)
const alphaOpShift = 11;            // 11 - 13 (3bits)
const alphaSrcFactorShift = 14;     // 14 - 17 (4bits)
const alphaDstFactorShift = 18;     // 18 - 21 (4bits)
const redWriteShift = 22;           // 22 (1 bit)
const greenWriteShift = 23;         // 23 (1 bit)
const blueWriteShift = 24;          // 24 (1 bit)
const alphaWriteShift = 25;         // 25 (1 bit)
const blendShift = 26;              // 26 (1 bit)

// combined values access
const allWriteMasks = 0b1111;
const allWriteShift = redWriteShift;
/**
 * BlendState is a descriptor that defines how output of fragment shader is written and blended
 * into render target. A blend state can be set on a material using {@link Material#blendState},
 * or in some cases on the graphics device using {@link GraphicsDevice#setBlendState}.
 *
 * For the best performance, do not modify blend state after it has been created, but create
 * multiple blend states and assign them to the material or graphics device as needed.
 *
 * @category Graphics
 */
class BlendState {
    /**
     * Bit field representing the blend state for render target 0.
     *
     * @private
     */
    target0 = 0;

    /**
     * Create a new BlendState instance.
     *
     * All factor parameters can take the following values:
     *
     * - {@link BLENDMODE_ZERO}
     * - {@link BLENDMODE_ONE}
     * - {@link BLENDMODE_SRC_COLOR}
     * - {@link BLENDMODE_ONE_MINUS_SRC_COLOR}
     * - {@link BLENDMODE_DST_COLOR}
     * - {@link BLENDMODE_ONE_MINUS_DST_COLOR}
     * - {@link BLENDMODE_SRC_ALPHA}
     * - {@link BLENDMODE_SRC_ALPHA_SATURATE}
     * - {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}
     * - {@link BLENDMODE_DST_ALPHA}
     * - {@link BLENDMODE_ONE_MINUS_DST_ALPHA}
     * - {@link BLENDMODE_CONSTANT}
     * - {@link BLENDMODE_ONE_MINUS_CONSTANT}
     *
     * All op parameters can take the following values:
     *
     * - {@link BLENDEQUATION_ADD}
     * - {@link BLENDEQUATION_SUBTRACT}
     * - {@link BLENDEQUATION_REVERSE_SUBTRACT}
     * - {@link BLENDEQUATION_MIN}
     * - {@link BLENDEQUATION_MAX}
     *
     * @param {boolean} [blend] - Enables or disables blending. Defaults to false.
     * @param {number} [colorOp] - Configures color blending operation. Defaults to
     * {@link BLENDEQUATION_ADD}.
     * @param {number} [colorSrcFactor] - Configures source color blending factor. Defaults to
     * {@link BLENDMODE_ONE}.
     * @param {number} [colorDstFactor] - Configures destination color blending factor. Defaults to
     * {@link BLENDMODE_ZERO}.
     * @param {number} [alphaOp] - Configures alpha blending operation. Defaults to
     * {@link BLENDEQUATION_ADD}.
     * @param {number} [alphaSrcFactor] - Configures source alpha blending factor. Defaults to
     * {@link BLENDMODE_ONE}.
     * @param {number} [alphaDstFactor] - Configures destination alpha blending factor. Defaults to
     * {@link BLENDMODE_ZERO}.
     * @param {boolean} [redWrite] - True to enable writing of the red channel and false otherwise.
     * Defaults to true.
     * @param {boolean} [greenWrite] - True to enable writing of the green channel and false
     * otherwise. Defaults to true.
     * @param {boolean} [blueWrite] - True to enable writing of the blue channel and false otherwise.
     * Defaults to true.
     * @param {boolean} [alphaWrite] - True to enable writing of the alpha channel and false
     * otherwise. Defaults to true.
     */
    constructor(blend = false, colorOp = BLENDEQUATION_ADD, colorSrcFactor = BLENDMODE_ONE, colorDstFactor = BLENDMODE_ZERO,
        alphaOp, alphaSrcFactor, alphaDstFactor,
        redWrite = true, greenWrite = true, blueWrite = true, alphaWrite = true) {
        this.setColorBlend(colorOp, colorSrcFactor, colorDstFactor);
        this.setAlphaBlend(alphaOp ?? colorOp, alphaSrcFactor ?? colorSrcFactor, alphaDstFactor ?? colorDstFactor);
        this.setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite);
        this.blend = blend;
    }

    /**
     * Sets whether blending is enabled.
     *
     * @type {boolean}
     */
    set blend(value) {
        this.target0 = BitPacking.set(this.target0, value ? 1 : 0, blendShift);
    }

    /**
     * Gets whether blending is enabled.
     *
     * @type {boolean}
     */
    get blend() {
        return BitPacking.all(this.target0, blendShift);
    }

    setColorBlend(op, srcFactor, dstFactor) {
        this.target0 = BitPacking.set(this.target0, op, colorOpShift, opMask);
        this.target0 = BitPacking.set(this.target0, srcFactor, colorSrcFactorShift, factorMask);
        this.target0 = BitPacking.set(this.target0, dstFactor, colorDstFactorShift, factorMask);
    }

    setAlphaBlend(op, srcFactor, dstFactor) {
        this.target0 = BitPacking.set(this.target0, op, alphaOpShift, opMask);
        this.target0 = BitPacking.set(this.target0, srcFactor, alphaSrcFactorShift, factorMask);
        this.target0 = BitPacking.set(this.target0, dstFactor, alphaDstFactorShift, factorMask);
    }

    setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite) {
        this.redWrite = redWrite;
        this.greenWrite = greenWrite;
        this.blueWrite = blueWrite;
        this.alphaWrite = alphaWrite;
    }

    get colorOp() {
        return BitPacking.get(this.target0, colorOpShift, opMask);
    }

    get colorSrcFactor() {
        return BitPacking.get(this.target0, colorSrcFactorShift, factorMask);
    }

    get colorDstFactor() {
        return BitPacking.get(this.target0, colorDstFactorShift, factorMask);
    }

    get alphaOp() {
        return BitPacking.get(this.target0, alphaOpShift, opMask);
    }

    get alphaSrcFactor() {
        return BitPacking.get(this.target0, alphaSrcFactorShift, factorMask);
    }

    get alphaDstFactor() {
        return BitPacking.get(this.target0, alphaDstFactorShift, factorMask);
    }

    set redWrite(value) {
        this.target0 = BitPacking.set(this.target0, value ? 1 : 0, redWriteShift);
    }

    get redWrite() {
        return BitPacking.all(this.target0, redWriteShift);
    }

    set greenWrite(value) {
        this.target0 = BitPacking.set(this.target0, value ? 1 : 0, greenWriteShift);
    }

    get greenWrite() {
        return BitPacking.all(this.target0, greenWriteShift);
    }

    set blueWrite(value) {
        this.target0 = BitPacking.set(this.target0, value ? 1 : 0, blueWriteShift);
    }

    get blueWrite() {
        return BitPacking.all(this.target0, blueWriteShift);
    }

    set alphaWrite(value) {
        this.target0 = BitPacking.set(this.target0, value ? 1 : 0, alphaWriteShift);
    }

    get alphaWrite() {
        return BitPacking.all(this.target0, alphaWriteShift);
    }

    get allWrite() {
        // return a number with all 4 bits, for fast compare
        return BitPacking.get(this.target0, allWriteShift, allWriteMasks);
    }

    /**
     * Copies the contents of a source blend state to this blend state.
     *
     * @param {BlendState} rhs - A blend state to copy from.
     * @returns {BlendState} Self for chaining.
     */
    copy(rhs) {
        this.target0 = rhs.target0;
        return this;
    }

    /**
     * Returns an identical copy of the specified blend state.
     *
     * @returns {this} The result of the cloning.
     */
    clone() {
        const clone = new this.constructor();
        return clone.copy(this);
    }

    get key() {
        return this.target0;
    }

    /**
     * Reports whether two BlendStates are equal.
     *
     * @param {BlendState} rhs - The blend state to compare to.
     * @returns {boolean} True if the blend states are equal and false otherwise.
     */
    equals(rhs) {
        return this.target0 === rhs.target0;
    }

    /**
     * A blend state that has blending disabled and writes to all color channels.
     *
     * @type {BlendState}
     * @readonly
     */
    static NOBLEND = Object.freeze(new BlendState());

    /**
     * A blend state that does not write to color channels.
     *
     * @type {BlendState}
     * @readonly
     */
    static NOWRITE = Object.freeze(new BlendState(undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, false, false));

    /**
     * A blend state that does simple translucency using alpha channel.
     *
     * @type {BlendState}
     * @readonly
     */
    static ALPHABLEND = Object.freeze(new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA));

    /**
     * A blend state that does simple additive blending.
     *
     * @type {BlendState}
     * @readonly
     */
    static ADDBLEND = Object.freeze(new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));
}

export { BlendState };
