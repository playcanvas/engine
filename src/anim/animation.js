Object.assign(pc, function () {
    var Key = function Key(time, position, rotation, scale) {
        this.time = time;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    };

    /**
     * @constructor
     * @name pc.Node
     * @classdesc A animation node has a name and contains an array of keyframes.
     * @description Create a new animation node.
     */
    var Node = function Node() {
        this._name = "";
        this._keys = [];
    };

    /**
     * @constructor
     * @name pc.LegacyAnimation
     * @classdesc An animation is a sequence of keyframe arrays which map to the nodes of a skeletal hierarchy.
     * It controls how the nodes of the hierarchy are transformed over time.
     * @property {String} name Human-readable name of the animation
     * @property {Number} duration Duration of the animation in seconds.
     */
    var LegacyAnimation = function LegacyAnimation() {
        this.name = '';
        this.duration = 0;
        this._nodes = [];
        this._nodeDict = {};
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.LegacyAnimation#getDuration
     * @description Returns the duration of the animation in seconds.
     * @returns {Number} The duration of the animation in seconds.
     */
    LegacyAnimation.prototype.getDuration = function () {
        return this.duration;
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.LegacyAnimation#getName
     * @description Returns the human-readable name of the animation.
     * @returns {String} The name of the animation.
     */
    LegacyAnimation.prototype.getName = function () {
        return this.name;
    };

    /**
     * @function
     * @name pc.LegacyAnimation#getNode
     * @description Gets a {@link pc.Node} by name
     * @param {String} name The name of the pc.Node
     * @returns {pc.Node} The pc.Node with the specified name
     */
    LegacyAnimation.prototype.getNode = function (name) {
        return this._nodeDict[name];
    };

    /**
     * @readonly
     * @name pc.LegacyAnimation#nodes
     * @type pc.Node[]
     * @description A read-only property to get array of animation nodes
     */
    Object.defineProperty(LegacyAnimation.prototype, 'nodes', {
        get: function () {
            return this._nodes;
        }
    });

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.LegacyAnimation#getNodes
     * @description Gets the {@link pc.Node}s of this {@link pc.LegacyAnimation}
     * @returns {pc.Node[]} An array of nodes.
     */
    LegacyAnimation.prototype.getNodes = function () {
        return this._nodes;
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.LegacyAnimation#setDuration
     * @description Sets the duration of the specified animation in seconds.
     * @param {Number} duration The duration of the animation in seconds.
     */
    LegacyAnimation.prototype.setDuration = function (duration) {
        this.duration = duration;
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.LegacyAnimation#setName
     * @description Sets the human-readable name of the specified animation.
     * @param {String} name The new name for the animation.
     */
    LegacyAnimation.prototype.setName = function (name) {
        this.name = name;
    };

    /**
     * @function
     * @name pc.LegacyAnimation#addNode
     * @description Adds a node to the internal nodes array.
     * @param {pc.Node} node The node to add.
     */
    LegacyAnimation.prototype.addNode = function (node) {
        this._nodes.push(node);
        this._nodeDict[node._name] = node;
    };

    return {
        LegacyAnimation: LegacyAnimation,
        Key: Key,
        Node: Node
    };
}());
