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
        this._name = "";
        this._keys = [];
    }
}

/**
 * An animation is a sequence of keyframe arrays which map to the nodes of a skeletal hierarchy. It
 * controls how the nodes of the hierarchy are transformed over time.
 *
 * @property {string} name Human-readable name of the animation.
 * @property {number} duration Duration of the animation in seconds.
 */
class Animation {
    /**
     * Create a new Animation instance.
     */
    constructor() {
        this.name = '';
        this.duration = 0;
        this._nodes = [];
        this._nodeDict = {};
    }

    /**
     * @function
     * @name Animation#getNode
     * @description Gets a {@link Node} by name.
     * @param {string} name - The name of the {@link Node}.
     * @returns {Node} The {@link Node} with the specified name.
     */
    getNode(name) {
        return this._nodeDict[name];
    }

    /**
     * @name Animation#nodes
     * @type {Node[]}
     * @description A read-only property to get array of animation nodes.
     */
    get nodes() {
        return this._nodes;
    }

    /**
     * @function
     * @name Animation#addNode
     * @description Adds a node to the internal nodes array.
     * @param {Node} node - The node to add.
     */
    addNode(node) {
        this._nodes.push(node);
        this._nodeDict[node._name] = node;
    }
}

export { Animation, Key, Node };
