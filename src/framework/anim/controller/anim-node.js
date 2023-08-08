import { Vec2 } from '../../../core/math/vec2.js';

/**
 * AnimNodes are used to represent a single animation track in the current state. Each state can
 * contain multiple AnimNodes, in which case they are stored in a BlendTree hierarchy, which will
 * control the weight (contribution to the states final animation) of its child AnimNodes.
 *
 * @ignore
 */
class AnimNode {
    /**
     * Create a new AnimNode instance.
     *
     * @param {import('./anim-state.js').AnimState} state - The AnimState that this BlendTree
     * belongs to.
     * @param {import('./anim-blend-tree.js').AnimBlendTree|null} parent - The parent of the AnimNode.
     * If not null, the AnimNode is stored as part of an {@link AnimBlendTree} hierarchy.
     * @param {string} name - The name of the AnimNode. Used when assigning an {@link AnimTrack} to
     * it.
     * @param {number[]|number} point - The coordinate/vector thats used to determine the weight of
     * this node when it's part of an {@link AnimBlendTree}.
     * @param {number} [speed] - The speed that its {@link AnimTrack} should play at. Defaults to 1.
     */
    constructor(state, parent, name, point, speed = 1) {
        this._state = state;
        this._parent = parent;
        this._name = name;
        if (Array.isArray(point)) {
            this._point = new Vec2(point[0], point[1]);
            this._pointLength = this._point.length();
        } else {
            this._point = point;
            this._pointLength = point;
        }

        this._speed = speed;
        this._weightedSpeed = 1.0;
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

    get pointLength() {
        return this._pointLength;
    }

    set weight(value) {
        this._weight = value;
    }

    get weight() {
        return this._parent ? this._parent.weight * this._weight : this._weight;
    }

    get normalizedWeight() {
        const totalWeight = this._state.totalWeight;
        if (totalWeight === 0.0) return 0.0;
        return this.weight / totalWeight;
    }

    get speed() {
        return this._weightedSpeed * this._speed;
    }

    get absoluteSpeed() {
        return Math.abs(this._speed);
    }

    set weightedSpeed(weightedSpeed) {
        this._weightedSpeed = weightedSpeed;
    }

    get weightedSpeed() {
        return this._weightedSpeed;
    }

    set animTrack(value) {
        this._animTrack = value;
    }

    get animTrack() {
        return this._animTrack;
    }
}

export { AnimNode };
