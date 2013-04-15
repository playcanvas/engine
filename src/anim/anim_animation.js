pc.anim.Key = function Key() {
    this._quat = pc.math.quat.create(0, 0, 0, 0);
    this._pos  = pc.math.vec3.create(0, 0, 0);
    this._time = 0;
};

pc.anim.Node = function Node() {
    this._name = "";
    this._keys = [];
};

pc.extend(pc.anim, function () {
    /**
     * @name pc.anim.Animation
     * @class An animation is a sequence of keyframe arrays which map to the nodes of a skeletal hierarchy.
     * It controls how the nodes of the hierarchy are transformed over time.
     * @description Returns a new pc.anim.Animation object.
     */
    var Animation = function Animation() {
        this._name = "";
        this._duration = 0;
        this._nodes = [];
        this._nodeDict = {};
    };

    /**
     * @function
     * @name pc.anim.Animation#getDuration
     * @description Returns the duration of the animation in seconds.
     * @returns {number} The duration of the animation in seconds.
     * @author Will Eastcott
     */
    Animation.prototype.getDuration = function () {
        return this._duration;
    };

    /**
     * @function
     * @name pc.anim.Animation#getName
     * @description Returns the human-readable name of the animation.
     * @returns {string} The name of the animation.
     * @author Will Eastcott
     */
    Animation.prototype.getName = function () {
        return this._name;
    };

    /**
     * @function
     * @name pc.anim.Animation#getNode
     * @description
     * @returns {pc.anim.Node}
     * @author Will Eastcott
     */
    Animation.prototype.getNode = function (name) {
        return this._nodeDict[name];
    };

    /**
     * @function
     * @name pc.anim.Animation#getNodes
     * @description
     * @returns {Array}
     * @author Will Eastcott
     */
    Animation.prototype.getNodes = function () {
        return this._nodes;
    };

    /**
     * @function
     * @name pc.anim.Animation#setDuration
     * @description Sets the duration of the specified animation in seconds.
     * @param {number} duration The duration of the animation in seconds.
     * @author Will Eastcott
     */
    Animation.prototype.setDuration = function (duration) {
        this._duration = duration;
    };

    /**
     * @function
     * @name pc.anim.Animation#setName
     * @description Sets the human-readable name of the specified animation.
     * @param {number} name The new name for the animation.
     * @author Will Eastcott
     */
    Animation.prototype.setName = function (name) {
        this._name = name;
    };

    /**
     * @function
     * @name pc.anim.Animation#setNode
     * @description
     * @param {String} name
     * @param {pc.anim.Node} node
     * @author Will Eastcott
     */
    Animation.prototype.addNode = function (node) {
        this._nodes.push(node);
        this._nodeDict[node._name] = node;
    };

    return {
        Animation: Animation
    }; 
}());