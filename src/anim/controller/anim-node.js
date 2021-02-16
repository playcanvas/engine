/**
 * @private
 * @class
 * @name AnimNode
 * @classdesc AnimNodes are used to represent a single animation track in the current state. Each state can contain multiple AnimNodes, in which case they are stored in a BlendTree hierarchy, which will control the weight (contribution to the states final animation) of it's child AnimNodes.
 * @description Create a new AnimNode.
 * @param {AnimState} state - The AnimState that this BlendTree belongs to.
 * @param {BlendTree|null} parent - The parent of the AnimNode. If not null, the AnimNode is stored as part of a {@link BlendTree} hierarchy.
 * @param {string} name - The name of the AnimNode. Used when assigning a {@link AnimTrack} to it.
 * @param {number[]|Vec2} point - The coordinate/vector thats used to determine the weight of this node when it's part of a {@link BlendTree}.
 * @param {number} [speed] - The speed that its {@link AnimTrack} should play at. Defaults to 1.
 */
class AnimNode {
    constructor(state, parent, name, point, speed = 1) {
        this._state = state;
        this._parent = parent;
        this._name = name;
        this._point = Array.isArray(point) ? new pc.Vec2(point) : point;
        this._speed = speed;
        this._weight = 1.0;
        this._animTrack = null;
    }

    get parent() {
        return this._parent;
    }

    get name() {
        return this._name;
    }

    get path() {
        return this._parent ? this._parent.path + '.' + this._name : this._name;
    }

    get point() {
        return this._point;
    }

    get weight() {
        return this._parent ? this._parent.weight * this._weight : this._weight;
    }

    set weight(value) {
        this._weight = value;
    }

    get normalizedWeight() {
        var totalWeight = this._state.totalWeight;
        if (totalWeight === 0.0) return 0.0;
        return this.weight / totalWeight;
    }

    get speed() {
        return this._speed;
    }

    get animTrack() {
        return this._animTrack;
    }

    set animTrack(value) {
        this._animTrack = value;
    }
}

export { AnimNode };
