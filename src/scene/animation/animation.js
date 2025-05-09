class AnimationKey {
    constructor(time, position, rotation, scale) {
        this.time = time;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }
}

/**
 * AnimationNode represents an array of keyframes that animate the transform of a {@link GraphNode}
 * over time. Typically, an {@link Animation} maintains a collection of AnimationNodes, one for
 * each GraphNode in a {@link Skeleton}.
 *
 * @category Animation
 */
class AnimationNode {
    /**
     * Create a new AnimationNode instance.
     */
    constructor() {
        this._name = '';
        this._keys = [];
    }
}

/**
 * An Animation contains the data that defines how a {@link Skeleton} animates over time. The
 * Animation contains an array of {@link AnimationNode}s, where each AnimationNode targets a
 * specific {@link GraphNode} referenced by a {@link Skeleton}.
 *
 * An Animation can be played back by an {@link AnimationComponent}.
 *
 * @category Animation
 */
class Animation {
    /**
     * Human-readable name of the animation.
     *
     * @type {string}
     */
    name = '';

    /**
     * Duration of the animation in seconds.
     *
     * @type {number}
     */
    duration = 0;

    /**
     * Create a new Animation instance.
     */
    constructor() {
        this._nodes = [];
        this._nodeDict = {};
    }

    /**
     * Gets a {@link AnimationNode} by name.
     *
     * @param {string} name - The name of the {@link AnimationNode}.
     * @returns {AnimationNode} The {@link AnimationNode} with the specified name.
     */
    getNode(name) {
        return this._nodeDict[name];
    }

    /**
     * Adds a node to the internal nodes array.
     *
     * @param {AnimationNode} node - The node to add.
     */
    addNode(node) {
        this._nodes.push(node);
        this._nodeDict[node._name] = node;
    }

    /**
     * A read-only property to get array of animation nodes.
     *
     * @type {AnimationNode[]}
     */
    get nodes() {
        return this._nodes;
    }
}

export { Animation, AnimationKey, AnimationNode };
