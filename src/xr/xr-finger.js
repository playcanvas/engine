/** @typedef {import('./xr-hand.js').XrHand} XrHand */
/** @typedef {import('./xr-joint.js').XrJoint} XrJoint */

/**
 * Represents finger with related joints and index.
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
     * @param {number} index - Index of a finger.
     * @param {XrHand} hand - Hand that finger relates to.
     * @hideconstructor
     */
    constructor(index, hand) {
        this._index = index;
        this._hand = hand;
        this._hand._fingers.push(this);
    }

    /**
     * Index of a finger, numeration is: thumb, index, middle, ring, little.
     *
     * @type {number}
     */
    get index() {
        return this._index;
    }

    /**
     * Hand that finger relates to.
     *
     * @type {XrHand}
     */
    get hand() {
        return this._hand;
    }

    /**
     * List of joints that relates to this finger, starting from joint closest to wrist all the way
     * to the tip of a finger.
     *
     * @type {XrJoint[]}
     */
    get joints() {
        return this._joints;
    }

    /**
     * Tip of a finger, or null if not available.
     *
     * @type {XrJoint|null}
     */
    get tip() {
        return this._tip;
    }
}

export { XrFinger };
