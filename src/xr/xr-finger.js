/**
 * @class
 * @name XrFinger
 * @classdesc Represents finger with related joints and index
 * @description Represents finger with related joints and index
 * @param {number} index - Index of a finger
 * @param {XrHand} hand - Hand that finger relates to
 * @property {number} index Index of a finger, numeration is: thumb, index, middle, ring, little
 * @property {pc.XrHand} hand Hand that finger relates to
 * @property {pc.XrJoint[]} joints List of joints that relates to this finger, starting from joint closest to wrist all the way to the tip of a finger
 * @property {pc.XrJoint|null} tip Tip of a finger, or null if not available
 */
class XrFinger {
    constructor(index, hand) {
        this._index = index;
        this._hand = hand;
        this._hand._fingers.push(this);
        this._joints = [];
        this._tip = null;
    }

    get index() {
        return this._index;
    }

    get hand() {
        return this._hand;
    }

    get joints() {
        return this._joints;
    }

    get tip() {
        return this._tip;
    }
}

export { XrFinger };
