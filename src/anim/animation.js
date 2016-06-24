pc.extend(pc, function () {
    var Key = function Key(time, position, rotation, scale) {
        this.time = time;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    };

    /**
     * @name pc.Node
     * @class A animation node has a name and contains an array of keyframes.
     * @description Create a new animation node
     * @returns {pc.Node} A new pc.Node.
     */
    var Node = function Node() {
        this._name = "";
        this._keys = [];
    };

    /**
     * @name pc.Animation
     * @property {String} name Human-readable name of the animation
     * @property {Number} duration Duration of the animation in seconds.
     * @class An animation is a sequence of keyframe arrays which map to the nodes of a skeletal hierarchy.
     * It controls how the nodes of the hierarchy are transformed over time.
     * @returns {pc.Animation} A new pc.Animation object.
     */
    var Animation = function Animation() {
        this.name = '';
        this.duration = 0;
        this._nodes = [ ];
        this._nodeDict = {};
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Animation#getDuration
     * @description Returns the duration of the animation in seconds.
     * @returns {Number} The duration of the animation in seconds.
     * @author Will Eastcott
     */
    Animation.prototype.getDuration = function () {
        return this.duration;
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Animation#getName
     * @description Returns the human-readable name of the animation.
     * @returns {String} The name of the animation.
     * @author Will Eastcott
     */
    Animation.prototype.getName = function () {
        return this.name;
    };

    /**
     * @function
     * @name pc.Animation#getNode
     * @description Gets a {@link pc.Node} by name
     * @param {String} name The name of the pc.Node
     * @returns {pc.Node} The pc.Node with the specified name
     * @author Will Eastcott
     */
    Animation.prototype.getNode = function (name) {
        return this._nodeDict[name];
    };

    /**
     * @readonly
     * @name pc.Animation#nodes
     * @type pc.Node[]
     * @description A read-only property to get array of animation nodes
     */
    Object.defineProperty(Animation.prototype, 'nodes', {
        get: function () {
            return this._nodes;
        }
    });

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Animation#getNodes
     * @description Gets the {@link pc.Node}s of this {@link pc.Animation}
     * @returns {pc.Node[]} An array of nodes.
     * @author Will Eastcott
     */
    Animation.prototype.getNodes = function () {
        return this._nodes;
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Animation#setDuration
     * @description Sets the duration of the specified animation in seconds.
     * @param {Number} duration The duration of the animation in seconds.
     * @author Will Eastcott
     */
    Animation.prototype.setDuration = function (value) {
        this.duration = value;
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Animation#setName
     * @description Sets the human-readable name of the specified animation.
     * @param {String} name The new name for the animation.
     * @author Will Eastcott
     */
    Animation.prototype.setName = function (value) {
        this.name = value;
    };

    /**
     * @function
     * @name pc.Animation#addNode
     * @description Adds a node the the internal nodes array.
     * @param {pc.Node} node The node to add.
     * @author Will Eastcott
     */
    Animation.prototype.addNode = function (node) {
        this._nodes.push(node);
        this._nodeDict[node._name] = node;
    };

    return {
        Animation: Animation,
        Key: Key,
        Node: Node
    };
}());
