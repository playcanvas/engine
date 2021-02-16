class Key {
    constructor(time, position, rotation, scale) {
        this.time = time;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }
}

/**
 * @class
 * @name Node
 * @classdesc A animation node has a name and contains an array of keyframes.
 * @description Create a new animation node.
 */
class Node {
    constructor() {
        this._name = "";
        this._keys = [];
    }
}

/**
 * @class
 * @name Animation
 * @classdesc An animation is a sequence of keyframe arrays which map to the nodes of a skeletal hierarchy.
 * It controls how the nodes of the hierarchy are transformed over time.
 * @property {string} name Human-readable name of the animation.
 * @property {number} duration Duration of the animation in seconds.
 */
class Animation {
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
     * @param {string} name - The name of the pc.Node.
     * @returns {pc.Node} The pc.Node with the specified name.
     */
    getNode(name) {
        return this._nodeDict[name];
    }

    /**
     * @readonly
     * @name Animation#nodes
     * @type {pc.Node[]}
     * @description A read-only property to get array of animation nodes.
     */
    get nodes() {
        return this._nodes;
    }

    /**
     * @function
     * @name Animation#addNode
     * @description Adds a node to the internal nodes array.
     * @param {pc.Node} node - The node to add.
     */
    addNode(node) {
        this._nodes.push(node);
        this._nodeDict[node._name] = node;
    }
}

export { Animation, Key, Node };
