/**
 * @import { XrHand } from './xr-hand.js'
 * @import { XrJoint } from './xr-joint.js'
 */

/**
 * Represents a finger of a tracked {@link XrHand} with related joints and index.
 *
 * @category XR
 */
class XrFinger {
    /**
     * @type {number}
     * @private
     */
    _index;

    /**
     * @type {XrHand}
     * @private
     */
    _hand;

    /**
     * @type {XrJoint[]}
     * @private
     */
    _joints = [];

    /**
     * @type {XrJoint|null}
     * @private
     */
    _tip = null;

    /**
     * Create a new XrFinger instance.
     *
     * @param {number} index - Index of the finger.
     * @param {XrHand} hand - Hand that the finger belongs to.
     * @ignore
     */
    constructor(index, hand) {
        this._index = index;
        this._hand = hand;
        this._hand._fingers.push(this);
    }

    /**
     * Gets the index of the finger. Enumeration is: thumb, index, middle, ring, little.
     *
     * @type {number}
     */
    get index() {
        return this._index;
    }

    /**
     * Gets the hand that the finger belongs to.
     *
     * @type {XrHand}
     */
    get hand() {
        return this._hand;
    }

    /**
     * Array of joints that belong to this finger, starting from joint closest to wrist all the way
     * to the tip of a finger.
     *
     * @type {XrJoint[]}
     */
    get joints() {
        return this._joints;
    }

    /**
     * Tip joint of the finger, or null if not available.
     *
     * @type {XrJoint|null}
     */
    get tip() {
        return this._tip;
    }
}

export { XrFinger };
