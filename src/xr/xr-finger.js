/**
 * @class
 * @name pc.XrFinger
 * @classdesc Represents finger with related joints and index
 * @description Represents finger with related joints and index
 * @param {number} index - Index of a finger
 * @param {pc.XrHand} hand - Hand that finger relates to
 * @property {number} index Index of a finger, numeration is: thumb, index, middle, ring, little
 * @property {pc.XrHand} hand Hand that finger relates to
 * @property {pc.XrJoint[]} joints List of joints that relates to this finger, starting from joint closest to wrist all the way to the tip of a finger
 * @property {pc.XrJoint|null} tip Tip of a finger, or null if not available
 */
function XrFinger(index, hand) {
    this._index = index;
    this._hand = hand;
    this._hand._fingers.push(this);
    this._joints = [];
    this._tip = null;
}

Object.defineProperty(XrFinger.prototype, 'index', {
    get: function () {
        return this._index;
    }
});

Object.defineProperty(XrFinger.prototype, 'hand', {
    get: function () {
        return this._hand;
    }
});

Object.defineProperty(XrFinger.prototype, 'joints', {
    get: function () {
        return this._joints;
    }
});

Object.defineProperty(XrFinger.prototype, 'tip', {
    get: function () {
        return this._tip;
    }
});

export { XrFinger };
