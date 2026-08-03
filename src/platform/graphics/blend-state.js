import { Debug } from '../../core/debug.js';
import { BitPacking } from '../../core/math/bit-packing.js';
import { StringIds } from '../../core/string-ids.js';
import {
    BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ZERO, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDMODE_SRC1_COLOR, BLENDMODE_ONE_MINUS_SRC1_ALPHA
} from '../../platform/graphics/constants.js';

const stringIds = new StringIds();

// masks (to only keep relevant bits)
const opMask = 0b111;
const factorMask = 0b11111;

// shifts values to where individual parts are stored
const colorOpShift = 0;             // 00 - 02 (3bits)
const colorSrcFactorShift = 3;      // 03 - 07 (5bits)
const colorDstFactorShift = 8;      // 08 - 12 (5bits)
const alphaOpShift = 13;            // 13 - 15 (3bits)
const alphaSrcFactorShift = 16;     // 16 - 20 (5bits)
const alphaDstFactorShift = 21;     // 21 - 25 (5bits)
const redWriteShift = 26;           // 26 (1 bit)
const greenWriteShift = 27;         // 27 (1 bit)
const blueWriteShift = 28;          // 28 (1 bit)
const alphaWriteShift = 29;         // 29 (1 bit)
const blendShift = 30;              // 30 (1 bit)

// combined values access
const allWriteMasks = 0b1111;
const allWriteShift = redWriteShift;

// Bit 31 of attachment0 flags the presence of per-attachment overrides, making attachment0 negative.
// This allows a single compare to detect them, and partitions the key space so an interned
// per-attachment key can never collide with the raw attachment0 value of a state without overrides.
const overridesBit = 1 << 31;

// attachment0 with the overrides flag removed - the plain 31 bit blend state
const stateMask = 0x7fffffff;

// maximum number of color attachments a blend state can describe, matching the maximum supported
// by the graphics APIs
const maxAttachments = 8;

const usesSecondarySource = factor => factor >= BLENDMODE_SRC1_COLOR && factor <= BLENDMODE_ONE_MINUS_SRC1_ALPHA;

// True if any blend factor of the supplied packed state uses the secondary fragment output.
const stateUsesSecondarySource = state => (
    usesSecondarySource(BitPacking.get(state, colorSrcFactorShift, factorMask)) ||
    usesSecondarySource(BitPacking.get(state, colorDstFactorShift, factorMask)) ||
    usesSecondarySource(BitPacking.get(state, alphaSrcFactorShift, factorMask)) ||
    usesSecondarySource(BitPacking.get(state, alphaDstFactorShift, factorMask))
);

/**
 * BlendState is a descriptor that defines how output of fragment shader is written and blended
 * into render target. A blend state can be set on a material using {@link Material#blendState},
 * or in some cases on the graphics device using {@link GraphicsDevice#setBlendState}.
 *
 * For the best performance, do not modify blend state after it has been created, but create
 * multiple blend states and assign them to the material or graphics device as needed.
 *
 * By default the blend state applies to all color attachments of the render target. When multiple
 * color attachments are used, individual attachments can be given an independent blend state using
 * {@link BlendState#setAttachment}. This requires {@link GraphicsDevice#supportsIndependentBlending} -
 * on devices without support, the state of the attachment 0 is used for all attachments.
 *
 * @category Graphics
 */
class BlendState {
    /**
     * Bit field representing the blend state for attachment 0. Bit 31 additionally flags the
     * presence of per-attachment overrides.
     *
     * @private
     */
    attachment0 = 0;

    /**
     * Per-attachment blend states, indexed directly by the attachment index. Slot 0 is unused and
     * always zero, as attachment 0 is stored in `attachment0`. A slot value of zero means the
     * attachment follows attachment 0. Allocated lazily, only when an override is set.
     *
     * @type {Int32Array|null}
     * @private
     */
    _attachments = null;

    /**
     * Interned key of a state with per-attachment overrides. Unused by states without overrides,
     * which use attachment0 as their key directly.
     *
     * @private
     */
    _key = 0;

    /**
     * True when `_key` needs re-evaluating. Set by all attachment 0 mutations, and only relevant
     * when per-attachment overrides are present.
     *
     * @private
     */
    _keyDirty = false;

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
     * - {@link BLENDMODE_SRC1_COLOR}
     * - {@link BLENDMODE_ONE_MINUS_SRC1_COLOR}
     * - {@link BLENDMODE_SRC1_ALPHA}
     * - {@link BLENDMODE_ONE_MINUS_SRC1_ALPHA}
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
        this.attachment0 = BitPacking.set(this.attachment0, value ? 1 : 0, blendShift);
        this._keyDirty = true;
    }

    /**
     * Gets whether blending is enabled.
     *
     * @type {boolean}
     */
    get blend() {
        return BitPacking.all(this.attachment0, blendShift);
    }

    setColorBlend(op, srcFactor, dstFactor) {
        this.attachment0 = BitPacking.set(this.attachment0, op, colorOpShift, opMask);
        this.attachment0 = BitPacking.set(this.attachment0, srcFactor, colorSrcFactorShift, factorMask);
        this.attachment0 = BitPacking.set(this.attachment0, dstFactor, colorDstFactorShift, factorMask);
        this._keyDirty = true;
    }

    setAlphaBlend(op, srcFactor, dstFactor) {
        this.attachment0 = BitPacking.set(this.attachment0, op, alphaOpShift, opMask);
        this.attachment0 = BitPacking.set(this.attachment0, srcFactor, alphaSrcFactorShift, factorMask);
        this.attachment0 = BitPacking.set(this.attachment0, dstFactor, alphaDstFactorShift, factorMask);
        this._keyDirty = true;
    }

    setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite) {
        this.redWrite = redWrite;
        this.greenWrite = greenWrite;
        this.blueWrite = blueWrite;
        this.alphaWrite = alphaWrite;
    }

    get colorOp() {
        return BitPacking.get(this.attachment0, colorOpShift, opMask);
    }

    get colorSrcFactor() {
        return BitPacking.get(this.attachment0, colorSrcFactorShift, factorMask);
    }

    get colorDstFactor() {
        return BitPacking.get(this.attachment0, colorDstFactorShift, factorMask);
    }

    get alphaOp() {
        return BitPacking.get(this.attachment0, alphaOpShift, opMask);
    }

    get alphaSrcFactor() {
        return BitPacking.get(this.attachment0, alphaSrcFactorShift, factorMask);
    }

    get alphaDstFactor() {
        return BitPacking.get(this.attachment0, alphaDstFactorShift, factorMask);
    }

    set redWrite(value) {
        this.attachment0 = BitPacking.set(this.attachment0, value ? 1 : 0, redWriteShift);
        this._keyDirty = true;
    }

    get redWrite() {
        return BitPacking.all(this.attachment0, redWriteShift);
    }

    set greenWrite(value) {
        this.attachment0 = BitPacking.set(this.attachment0, value ? 1 : 0, greenWriteShift);
        this._keyDirty = true;
    }

    get greenWrite() {
        return BitPacking.all(this.attachment0, greenWriteShift);
    }

    set blueWrite(value) {
        this.attachment0 = BitPacking.set(this.attachment0, value ? 1 : 0, blueWriteShift);
        this._keyDirty = true;
    }

    get blueWrite() {
        return BitPacking.all(this.attachment0, blueWriteShift);
    }

    set alphaWrite(value) {
        this.attachment0 = BitPacking.set(this.attachment0, value ? 1 : 0, alphaWriteShift);
        this._keyDirty = true;
    }

    get alphaWrite() {
        return BitPacking.all(this.attachment0, alphaWriteShift);
    }

    get allWrite() {
        // return a number with all 4 bits, for fast compare
        return BitPacking.get(this.attachment0, allWriteShift, allWriteMasks);
    }

    /**
     * Gets whether any color attachment has been given an independent blend state using
     * {@link BlendState#setAttachment}.
     *
     * @type {boolean}
     */
    get hasAttachmentOverrides() {
        return this.attachment0 < 0;
    }

    /**
     * Assigns an independent blend state to the specified color attachment. The blend state of the
     * supplied source is copied, and so subsequent changes to either the source or to attachment 0 do
     * not affect it. An attachment which has not been assigned an independent state instead follows
     * attachment 0.
     *
     * Note that this requires {@link GraphicsDevice#supportsIndependentBlending} - on devices
     * without support, the state of attachment 0 is used for all attachments.
     *
     * @param {number} index - The index of the color attachment, in 1 to 7 range. Attachment 0 is
     * configured using the other functions and properties of this class.
     * @param {BlendState|null} src - The blend state to copy from, or null to make the attachment
     * follow attachment 0 again.
     * @example
     * // attachment 1 keeps the blending of attachment 0, but does not write any channels
     * const state = material.blendState.clone();
     * const noWrite = state.clone();
     * noWrite.setColorWrite(false, false, false, false);
     * state.setAttachment(1, noWrite);
     */
    setAttachment(index, src) {
        Debug.assert(index >= 1 && index < maxAttachments,
            `BlendState#setAttachment index ${index} is out of range, it must be in 1 to ${maxAttachments - 1} range. Attachment 0 is configured using the other functions of the class.`);
        Debug.assert(!src || !src.hasAttachmentOverrides,
            'BlendState#setAttachment source must not have per-attachment overrides of its own, as only its attachment 0 state is used.');
        Debug.assert(!src || (src.attachment0 & stateMask) !== 0,
            'BlendState#setAttachment source must not be a blend state with all properties set to zero, as this value is reserved to mean the attachment follows attachment 0.');

        this._attachments ??= new Int32Array(maxAttachments);
        this._attachments[index] = src ? (src.attachment0 & stateMask) : 0;
        this._attachmentsUpdated();
    }

    /**
     * Removes the independent blend state of the specified color attachment, making it follow
     * attachment 0 again.
     *
     * @param {number} index - The index of the color attachment, in 1 to 7 range.
     */
    clearAttachment(index) {
        this.setAttachment(index, null);
    }

    /**
     * Stores the blend state of the specified color attachment in the supplied blend state. When
     * the attachment does not have an independent blend state, the state of attachment 0 is stored.
     *
     * @param {number} index - The index of the color attachment, in 0 to 7 range.
     * @param {BlendState} dst - The blend state to store the result in. This avoids allocations, as
     * a single instance can be reused.
     * @returns {BlendState} The supplied dst, for chaining.
     */
    getAttachment(index, dst) {
        Debug.assert(index >= 0 && index < maxAttachments,
            `BlendState#getAttachment index ${index} is out of range, it must be in 0 to ${maxAttachments - 1} range.`);

        // the overrides flag is the authority - the per-attachment values are ignored without it, as
        // they can be stale after a copy from a state which has no overrides. Slot 0 is always
        // zero, and so index 0 correctly falls through to attachment0.
        const state = this.hasAttachmentOverrides ? this._attachments[index] : 0;
        dst.attachment0 = state !== 0 ? state : (this.attachment0 & stateMask);
        return dst;
    }

    /**
     * Refreshes the overrides flag and the interned key after the per-attachment states have changed.
     *
     * @private
     */
    _attachmentsUpdated() {
        const attachments = this._attachments;
        let overrides = false;
        for (let i = 1; i < maxAttachments; i++) {
            if (attachments[i] !== 0) {
                overrides = true;
                break;
            }
        }

        this.attachment0 = overrides ? (this.attachment0 | overridesBit) : (this.attachment0 & stateMask);

        // evaluate the key immediately - this way the normal lifecycle never leaves a state with
        // overrides needing a lazy evaluation, which would fail on a frozen instance
        if (overrides) {
            this._evalKey();
        } else {
            this._keyDirty = false;
        }
    }

    /**
     * Assigns a unique key to the combination of attachment 0 and the per-attachment states.
     *
     * @private
     */
    _evalKey() {
        this._key = overridesBit | stringIds.get(`${this.attachment0}-${this._attachments.join('-')}`);
        this._keyDirty = false;
    }

    /**
     * True if any blend factor uses the secondary fragment output.
     *
     * @type {boolean}
     * @ignore
     */
    get usesDualSourceBlending() {
        if (stateUsesSecondarySource(this.attachment0)) {
            return true;
        }

        if (this.hasAttachmentOverrides) {
            const attachments = this._attachments;
            for (let i = 1; i < maxAttachments; i++) {
                if (attachments[i] !== 0 && stateUsesSecondarySource(attachments[i])) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Copies the contents of a source blend state to this blend state.
     *
     * @param {BlendState} rhs - A blend state to copy from.
     * @returns {BlendState} Self for chaining.
     */
    copy(rhs) {
        this.attachment0 = rhs.attachment0;

        // per-attachment states are only copied when the source has them - the overrides flag is the
        // authority on whether they are used, and so stale values are harmless
        if (rhs.hasAttachmentOverrides) {
            this._attachments ??= new Int32Array(maxAttachments);
            this._attachments.set(rhs._attachments);
        }

        this._key = rhs._key;
        this._keyDirty = rhs._keyDirty;
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
        // without per-attachment overrides, attachment0 is a unique key on its own
        if (this.attachment0 >= 0) {
            return this.attachment0;
        }

        if (this._keyDirty) {
            this._evalKey();
        }
        return this._key;
    }

    /**
     * Reports whether two BlendStates are equal.
     *
     * @param {BlendState} rhs - The blend state to compare to.
     * @returns {boolean} True if the blend states are equal and false otherwise.
     */
    equals(rhs) {
        return this.key === rhs.key;
    }

    /**
     * A blend state that has blending disabled and writes to all color channels.
     *
     * @type {BlendState}
     * @readonly
     */
    static NOBLEND = Object.freeze(new BlendState());

    /**
     * @deprecated BlendState.DEFAULT is deprecated. Use BlendState.NOBLEND instead.
     * @ignore
     */
    static get DEFAULT() {
        Debug.deprecated('BlendState.DEFAULT is deprecated. Use BlendState.NOBLEND instead.');
        return BlendState.NOBLEND;
    }

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
