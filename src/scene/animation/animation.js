class Key {
    constructor(time, position, rotation, scale) {
        this.time = time;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }
}

/**
 * A animation node has a name and contains an array of keyframes.
 */
class Node {
    /**
     * Create a new Node instance.
     */
    constructor() {
        this._name = '';
        this._keys = [];
    }
}

/**
 * An animation is a sequence of keyframe arrays which map to the nodes of a skeletal hierarchy. It
 * controls how the nodes of the hierarchy are transformed over time.
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
     * Gets a {@link Node} by name.
     *
     * @param {string} name - The name of the {@link Node}.
     * @returns {Node} The {@link Node} with the specified name.
     */
    getNode(name) {
        return this._nodeDict[name];
    }

    /**
     * Adds a node to the internal nodes array.
     *
     * @param {Node} node - The node to add.
     */
    addNode(node) {
        this._nodes.push(node);
        this._nodeDict[node._name] = node;
    }

    /**
     * A read-only property to get array of animation nodes.
     *
     * @type {Node[]}
     */
    get nodes() {
        return this._nodes;
    }
}

export { Animation, Key, Node };
