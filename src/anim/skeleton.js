Object.assign(pc, function () {
    function InterpolatedKey() {
        this._written = false;
        this._name = "";
        this._keyFrames = [];

        // Result of interpolation
        this._quat = new pc.Quat();
        this._pos = new pc.Vec3();
        this._scale = new pc.Vec3();

        // Optional destination for interpolated keyframe
        this._targetNode = null;
    }

    Object.assign(InterpolatedKey.prototype, {
        getTarget: function () {
            return this._targetNode;
        },

        setTarget: function (node) {
            this._targetNode = node;
        }
    });

    /**
     * @constructor
     * @name pc.Skeleton
     * @classdesc Represents a skeleton used to play animations.
     * @param {pc.GraphNode} graph The root pc.GraphNode of the skeleton.
     * @property {Boolean} looping Determines whether skeleton is looping its animation.
     */
    var Skeleton = function Skeleton(graph) {
        this._animation = null;
        this._time = 0;
        this.looping = true;

        this._interpolatedKeys = [];
        this._interpolatedKeyDict = {};
        this._currKeyIndices = {};

        this.graph = null;

        this._offset = 0;
        this._interpKey = null;

        var self = this;

        function addInterpolatedKeys(node) {
            var interpKey = new InterpolatedKey();
            interpKey._name = node.name;
            self._interpolatedKeys.push(interpKey);
            self._interpolatedKeyDict[node.name] = interpKey;
            self._currKeyIndices[node.name] = [0, 0, 0];

            for (var i = 0; i < node._children.length; i++)
                addInterpolatedKeys(node._children[i]);
        }

        addInterpolatedKeys(graph);
    };

    /**
     * @function
     * @name pc.Skeleton#addTime
     * @description Progresses the animation assigned to the specified skeleton by the
     * supplied time delta. If the delta takes the animation passed its end point, if
     * the skeleton is set to loop, the animation will continue from the beginning.
     * Otherwise, the animation's current time will remain at its duration (i.e. the
     * end).
     * @param {Number} delta The time in seconds to progress the skeleton's animation.
     */
    Skeleton.prototype.addTime = function (delta) {
        if (this._animation !== null) {
            var i;
            var node, nodeName;
            var keys, keyIndices, interpKey;
            var nodes = this._animation._nodes;
            var duration = this._animation.duration;

            // Check if we can early out
            if ((this._time === duration) && !this.looping) {
                return;
            }

            // Step the current time and work out if we need to jump ahead, clamp or wrap around
            this._time += delta;

            if (this._time > duration) {
                this._time = this.looping ? (this._time - duration) : duration;
                for (i = 0; i < nodes.length; i++) {
                    node = nodes[i];
                    nodeName = node._name;
                    this._currKeyIndices[nodeName] = [0, 0, 0];
                }
            } else if (this._time < 0) {
                this._time = this.looping ? duration : 0.0;
                for (i = 0; i < nodes.length; i++) {
                    node = nodes[i];
                    nodeName = node._name;
                    this._currKeyIndices[nodeName] = [
                        node._keys[pc.KEYTYPE_POS].length - 2,
                        node._keys[pc.KEYTYPE_ROT].length - 2,
                        node._keys[pc.KEYTYPE_SCL].length - 2
                    ];
                }
            }


            // For each animated node...

            // keys index offset
            this._offset = (delta >= 0 ? 1 : -1);

            for (i = 0; i < nodes.length; i++) {
                node = nodes[i];
                nodeName = node._name;
                keys = node._keys;
                keyIndices = this._currKeyIndices[nodeName];

                // Determine the interpolated keyframe for this animated node
                this._interpKey = this._interpolatedKeyDict[nodeName];
                if (this._interpKey === undefined) {
                    // #ifdef DEBUG
                    console.warn('Unknown skeleton node name: ' + nodeName);
                    // #endif
                    continue;
                }
                // If there's only a single key, just copy the key to the interpolated key...
                keyIndices[pc.KEYTYPE_POS] = this._interpolate(this._interpKey._pos, "lerp",
                                                               keys[pc.KEYTYPE_POS],
                                                               keyIndices[pc.KEYTYPE_POS]);
                keyIndices[pc.KEYTYPE_ROT] = this._interpolate(this._interpKey._quat, "slerp",
                                                               keys[pc.KEYTYPE_ROT],
                                                               keyIndices[pc.KEYTYPE_ROT]);
                keyIndices[pc.KEYTYPE_SCL] = this._interpolate(this._interpKey._scale, "lerp",
                                                               keys[pc.KEYTYPE_SCL],
                                                               keyIndices[pc.KEYTYPE_SCL]);
            }
        }
    };

    Skeleton.prototype._interpolate = function (target, op, keys, currKey) {
        var k1, k2, alpha;
        var foundKey = false;
        var newKeyIdx = 0;
        if (keys.length !== 1) {
            // Otherwise, find the keyframe pair for this node
            for (var currKeyIndex = currKey; currKeyIndex < keys.length - 1 && currKeyIndex >= 0; currKeyIndex += this._offset) {
                k1 = keys[currKeyIndex];
                k2 = keys[currKeyIndex + 1];

                if ((k1.time <= this._time) && (k2.time >= this._time)) {
                    alpha = (this._time - k1.time) / (k2.time - k1.time);

                    target[op](k1.value, k2.value, alpha);
                    this._interpKey._written = true;
                    newKeyIdx = currKeyIndex;

                    foundKey = true;
                    break;
                }
            }
        }
        if (keys.length === 1 || (!foundKey && this._time === 0.0 && this.looping)) {
            target.copy(keys[0].value);
            this._interpKey._written = true;
        }
        return newKeyIdx;
    };

    /**
     * @function
     * @name pc.Skeleton#blend
     * @description Blends two skeletons together.
     * @param {pc.Skeleton} skel1 Skeleton holding the first pose to be blended.
     * @param {pc.Skeleton} skel2 Skeleton holding the second pose to be blended.
     * @param {Number} alpha The value controlling the interpolation in relation to the two input
     * skeletons. The value is in the range 0 to 1, 0 generating skel1, 1 generating skel2 and anything
     * in between generating a spherical interpolation between the two.
     */
    Skeleton.prototype.blend = function (skel1, skel2, alpha) {
        var numNodes = this._interpolatedKeys.length;
        for (var i = 0; i < numNodes; i++) {
            var key1 = skel1._interpolatedKeys[i];
            var key2 = skel2._interpolatedKeys[i];
            var dstKey = this._interpolatedKeys[i];

            if (key1._written && key2._written) {
                dstKey._quat.slerp(key1._quat, skel2._interpolatedKeys[i]._quat, alpha);
                dstKey._pos.lerp(key1._pos, skel2._interpolatedKeys[i]._pos, alpha);
                dstKey._scale.lerp(key1._scale, key2._scale, alpha);
                dstKey._written = true;
            } else if (key1._written) {
                dstKey._quat.copy(key1._quat);
                dstKey._pos.copy(key1._pos);
                dstKey._scale.copy(key1._scale);
                dstKey._written = true;
            } else if (key2._written) {
                dstKey._quat.copy(key2._quat);
                dstKey._pos.copy(key2._pos);
                dstKey._scale.copy(key2._scale);
                dstKey._written = true;
            }
        }
    };

    /**
     * @name pc.Skeleton#animation
     * @type pc.Animation
     * @description Animation currently assigned to skeleton.
     */
    Object.defineProperty(Skeleton.prototype, 'animation', {
        get: function () {
            return this._animation;
        },
        set: function (value) {
            this._animation = value;
            this.currentTime = 0;
        }
    });

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Skeleton#getAnimation
     * @description Returns the animation currently assigned to the specified skeleton.
     * @returns {pc.Animation} The animation set on the skeleton.
     */
    Skeleton.prototype.getAnimation = function () {
        return this._animation;
    };

    /**
     * @name pc.Skeleton#currentTime
     * @type Number
     * @description Current time of currently active animation in seconds.
     * This value is between zero and the duration of the animation.
     */
    Object.defineProperty(Skeleton.prototype, 'currentTime', {
        get: function () {
            return this._time;
        },
        set: function (value) {
            this._time = value;
            var numNodes = this._interpolatedKeys.length;
            for (var i = 0; i < numNodes; i++) {
                var node = this._interpolatedKeys[i];
                var nodeName = node._name;
                this._currKeyIndices[nodeName] = [0, 0, 0];
            }

            this.addTime(0);
            this.updateGraph();
        }
    });

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Skeleton#getCurrentTime
     * @description Returns the current time of the currently active animation as set on
     * the specified skeleton. This value will be between zero and the duration of the
     * animation.
     * @returns {Number} The current time of the animation set on the skeleton.
     */
    Skeleton.prototype.getCurrentTime = function () {
        return this._time;
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Skeleton#setCurrentTime
     * @description Sets the current time of the currently active animation as set on
     * the specified skeleton. This value must be between zero and the duration of the
     * animation.
     * @param {Number} time The current time of the animation set on the skeleton.
     */
    Skeleton.prototype.setCurrentTime = function (time) {
        this.currentTime = time;
    };

    /**
     * @readonly
     * @name pc.Skeleton#numNodes
     * @type Number
     * @description Read-only property that returns number of nodes of a skeleton.
     */
    Object.defineProperty(Skeleton.prototype, 'numNodes', {
        get: function () {
            return this._interpolatedKeys.length;
        }
    });

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Skeleton#getNumNodes
     * @description Returns the number of nodes held by the specified skeleton.
     * @returns {Number} The number of nodes held by the specified skeleton.
     */
    Skeleton.prototype.getNumNodes = function () {
        return this._interpolatedKeys.length;
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Skeleton#setAnimation
     * @description Sets an animation on the specified skeleton.
     * @param {pc.Animation} animation The animation to set on the skeleton.
     */
    Skeleton.prototype.setAnimation = function (animation) {
        this.animation = animation;
    };

    /**
     * @function
     * @name pc.Skeleton#setGraph
     * @description Links a skeleton to a node hierarchy. The nodes animated skeleton are
     * then subsequently used to drive the local transformation matrices of the node
     * hierarchy.
     * @param {pc.GraphNode} graph The root node of the graph that the skeleton is to drive.
     */
    Skeleton.prototype.setGraph = function (graph) {
        var i;
        this.graph = graph;

        if (graph) {
            for (i = 0; i < this._interpolatedKeys.length; i++) {
                var interpKey = this._interpolatedKeys[i];
                var graphNode = graph.findByName(interpKey._name);
                this._interpolatedKeys[i].setTarget(graphNode);
            }
        } else {
            for (i = 0; i < this._interpolatedKeys.length; i++) {
                this._interpolatedKeys[i].setTarget(null);
            }
        }
    };

    /**
     * @function
     * @name pc.Skeleton#updateGraph
     * @description Synchronizes the currently linked node hierarchy with the current state of the
     * skeleton. Internally, this function converts the interpolated keyframe at each node in the
     * skeleton into the local transformation matrix at each corresponding node in the linked node
     * hierarchy.
     */
    Skeleton.prototype.updateGraph = function () {
        if (this.graph) {
            for (var i = 0; i < this._interpolatedKeys.length; i++) {
                var interpKey = this._interpolatedKeys[i];
                if (interpKey._written) {
                    var transform = interpKey.getTarget();

                    transform.localPosition.copy(interpKey._pos);
                    transform.localRotation.copy(interpKey._quat);
                    transform.localScale.copy(interpKey._scale);

                    if (!transform._dirtyLocal)
                        transform._dirtifyLocal();

                    interpKey._written = false;
                }
            }
        }
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Skeleton#setLooping
     * @description Specified whether a skeleton should loop its animation or not. If the animation
     * loops, it will wrap back to the start when adding time to the skeleton beyond the duration
     * of the animation. Otherwise, the animation stops at its end after a single play through.
     * @param {Boolean} looping True to cause the animation to loop back to the start on completion
     * and false otherwise.
     */
    Skeleton.prototype.setLooping = function (looping) {
        this.looping = looping;
    };

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Skeleton#getLooping
     * @description Queries the specified skeleton to determine whether it is looping its animation.
     * @returns {Boolean} True if the skeleton is looping the animation, false otherwise.
     */
    Skeleton.prototype.getLooping = function () {
        return this.looping;
    };

    return {
        Skeleton: Skeleton
    };
}());
