pc.extend(pc.anim, function () {
    function InterpolatedKey() {
        this._written = false;
        this._name = "";
        this._keyFrames = [];

        // Result of interpolation
        this._quat  = pc.math.quat.create(0, 0, 0, 0);
        this._pos   = pc.math.vec3.create(0, 0, 0);
        this._scale = pc.math.vec3.create(0, 0, 0);

        // Optional destination for interpolated keyframe
        this._targetNode = null;
    }

    InterpolatedKey.prototype = {
        getTarget: function () {
            return this._targetNode;
        },

        setTarget: function (node) {
            this._targetNode = node;
        }
    };

    /**
     * @name pc.anim.Skeleton
     * @class A skeleton.
     */
    var Skeleton = function Skeleton(graph) {
        this._animation = null;
        this._time = 0;
        this.looping = true;

        this._interpolatedKeys = [];
        this._interpolatedKeyDict = {};
        this._currKeyIndices = {};

        this.graph = null;

        var self = this;
        
        function addInterpolatedKeys(node) {
            var name = node.getName();
            var interpKey = new InterpolatedKey();
            interpKey._name = name;
            self._interpolatedKeys.push(interpKey);
            self._interpolatedKeyDict[name] = interpKey;
            self._currKeyIndices[name] = 0;

            var children = node.getChildren();
            for (var i = 0; i < children.length; i++) {
                addInterpolatedKeys(children[i]);
            }
        }

        addInterpolatedKeys(graph);
    };

    /**
     * @function
     * @name pc.anim.Skeleton#addTime
     * @description Progresses the animation assigned to the specified skeleton by the 
     * supplied time delta. If the delta takes the animation passed its end point, if 
     * the skeleton is set to loop, the animation will continue from the beginning. 
     * Otherwise, the animation's current time will remain at its duration (i.e. the
     * end).
     * @param {Number} delta The time in seconds to progress the skeleton's animation.
     * @author Will Eastcott
     */
    Skeleton.prototype.addTime = function (delta) {
        if (this._animation !== null) {
            // Check if we can early out
            if ((this._time === duration) && !this.looping) {
                return;
            }

            var i;
            var vlerp = pc.math.vec3.lerp;
            var qslerp = pc.math.quat.slerp;
            
            var node, nodeName;
            var keys, interpKey;
            var k1, k2, alpha;
            var nodes = this._animation.getNodes();

            // Step the current time and work out if we need to jump ahead, clamp or wrap around
            this._time += delta;
            var duration = this._animation.getDuration();
            if (this._time > duration) {
                this._time = this.looping ? 0.0 : duration;
                for (i = 0; i < nodes.length; i++) {
                    node = nodes[i];
                    nodeName = node._name;
                    this._currKeyIndices[nodeName] = 0;
                }
            }

            // For each animated node...
            for (i = 0; i < nodes.length; i++) {
                node = nodes[i];
                nodeName = node._name;
                keys = node._keys;

                // Determine the interpolated keyframe for this animated node
                interpKey = this._interpolatedKeyDict[nodeName];

                // If there's only a single key, just copy the key to the interpolated key...
                if (keys.length === 1) {
                    pc.math.quat.copy(keys[0]._quat, interpKey._quat);
                    pc.math.vec3.copy(keys[0]._pos, interpKey._pos);
                    pc.math.vec3.copy(keys[0]._scale, interpKey._scale);
                } else {
                    // Otherwise, find the keyframe pair for this node
                    for (var currKeyIndex = this._currKeyIndices[nodeName]; currKeyIndex < keys.length-1; currKeyIndex++) {
                        k1 = keys[currKeyIndex];
                        k2 = keys[currKeyIndex + 1];

                        if ((k1._time <= this._time) && (k2._time >= this._time)) {
                            alpha = (this._time - k1._time) / (k2._time - k1._time);

                            qslerp(k1._quat, k2._quat, alpha, interpKey._quat);
                            vlerp(k1._pos, k2._pos, alpha, interpKey._pos);
                            vlerp(k1._scale, k2._scale, alpha, interpKey._scale);
                            interpKey._written = true;

                            this._currKeyIndices[nodeName] = currKeyIndex;
                            continue;
                        }
                    }
                }
            }
        }
    };

    /**
     * @function
     * @name pc.anim.Skeleton#blend
     * @description Blends two skeletons together.
     * @param {pc.anim.Skeleton} skel1 Skeleton holding the first pose to be blended.
     * @param {pc.anim.Skeleton} skel2 Skeleton holding the second pose to be blended.
     * @param {Number} alpha The value controlling the interpolation in relation to the two input
     * skeletons. The value is in the range 0 to 1, 0 generating skel1, 1 generating skel2 and anything
     * in between generating a spherical interpolation between the two.
     * @author Will Eastcott
     */
    Skeleton.prototype.blend = function (skel1, skel2, alpha) {
        var numNodes = this._interpolatedKeys.length;
        for (var i = 0; i < numNodes; i++) {
            var key1 = skel1._interpolatedKeys[i];
            var key2 = skel2._interpolatedKeys[i];
            var dstKey = this._interpolatedKeys[i];

            if (key1._written && key2._written) {
                pc.math.quat.slerp(key1._quat, skel2._interpolatedKeys[i]._quat, alpha, dstKey._quat);
                pc.math.vec3.lerp(key1._pos, skel2._interpolatedKeys[i]._pos, alpha, dstKey._pos);
                pc.math.vec3.lerp(key1._scale, key2._scale, alpha, dstKey._scale);
                dstKey._written = true;
            } else if (key1._written) {
                pc.math.quat.copy(key1._quat, dstKey._quat);
                pc.math.vec3.copy(key1._pos, dstKey._pos);
                pc.math.vec3.copy(key1._scale, dstKey._scale);
                dstKey._written = true;
            } else if (key2._written) {
                pc.math.quat.copy(key2._quat, dstKey._quat);
                pc.math.vec3.copy(key2._pos, dstKey._pos);
                pc.math.vec3.copy(key2._scale, dstKey._scale);
                dstKey._written = true;
            }
        }
    };
    
    /**
     * @function
     * @name pc.anim.Skeleton#getAnimation
     * @description Returns the animation currently assigned to the specified skeleton.
     * @returns {pc.anim.Animation} The animation set on the skeleton.
     * @author Will Eastcott
     */
    Skeleton.prototype.getAnimation = function () {
        return this._animation;
    };

    /**
     * @function
     * @name pc.anim.Skeleton#getCurrentTime
     * @description Returns the current time of the currently active animation as set on
     * the specified skeleton. This value will be between zero and the duration of the 
     * animation.
     * @returns {Number} The current time of the animation set on the skeleton.
     * @author Will Eastcott
     */
    Skeleton.prototype.getCurrentTime = function () {
        return this._time;
    };

    /**
     * @function
     * @name pc.anim.Skeleton#setCurrentTime
     * @description Sets the current time of the currently active animation as set on
     * the specified skeleton. This value must be between zero and the duration of the 
     * animation.
     * @param {Number} time The current time of the animation set on the skeleton.
     * @author Will Eastcott
     */
    Skeleton.prototype.setCurrentTime = function (time) {
        this._time = time;
        var numNodes = this._interpolatedKeys.length;
        for (var i = 0; i < numNodes; i++) {
            var node = this._interpolatedKeys[i];
            var nodeName = node._name;
            this._currKeyIndices[nodeName] = 0;
        }

        this.addTime(0);
        this.updateGraph();
    };

    /**
     * @function
     * @name pc.anim.Skeleton#getNumNodes
     * @description Returns the number of nodes held by the specified skeleton.
     * @returns {Number} The number of nodes held by the specified skeleton.
     * @author Will Eastcott
     */
    Skeleton.prototype.getNumNodes = function () {
        return this._interpolatedKeys.length;
    };
    
    /**
     * @function
     * @name pc.anim.Skeleton#setAnimation
     * @description Sets an animation on the specified skeleton.
     * @param {pc.anim.Animation} animation The animation to set on the skeleton.
     * @author Will Eastcott
     */
    Skeleton.prototype.setAnimation = function (animation) {
        this._animation = animation;
        this.setCurrentTime(0);
    };
    
    /**
     * @function
     * @name pc.anim.Skeleton#setGraph
     * @description Links a skeleton to a node hierarchy. The nodes animated skeleton are
     * then subsequently used to drive the local transformation matrices of the node
     * hierarchy.
     * @param {pc.scene.GraphNode} graph The root node of the graph that the skeleton is to drive.
     * @author Will Eastcott
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
     * @name pc.anim.Skeleton#updateGraph
     * @description Synchronizes the currently linked node hierarchy with the current state of the
     * skeleton. Internally, this function converts the interpolated keyframe at each node in the
     * skeleton into the local transformation matrix at each corresponding node in the linked node
     * hierarchy.
     * @author Will Eastcott
     */
    Skeleton.prototype.updateGraph = function () {
        if (this.graph) {
            for (var i = 0; i < this._interpolatedKeys.length; i++) {
                var interpKey = this._interpolatedKeys[i];
                if (interpKey._written) {
                    var transform = interpKey.getTarget();

                    pc.math.vec3.copy(interpKey._pos, transform.localPosition);
                    pc.math.quat.copy(interpKey._quat, transform.localRotation);
                    pc.math.vec3.copy(interpKey._scale, transform.localScale);
                    transform.dirtyLocal = true;

                    interpKey._written = false;
                }
            }
        }
    };

    /**
     * @function
     * @name pc.anim.Skeleton#setLooping
     * @description Specified whether a skeleton should loop its animation or not. If the animation
     * loops, it will wrap back to the start when adding time to the skeleton beyond the duration
     * of the animation. Otherwise, the animation stops at its end after a single play through.
     * @param {Boolean} looping True to cause the animation to loop back to the start on completion
     * and false otherwise.
     * @author Will Eastcott
     */
    Skeleton.prototype.setLooping = function (looping) {
        this.looping = looping;
    };

    /**
     * @function
     * @name pc.anim.Skeleton#getLooping
     * @description Queries the specified skeleton to determine whether it is looping its animation.
     * @returns {Boolean} True if the skeleton is looping the animation, false otherwise.
     * @author Will Eastcott
     */
    Skeleton.prototype.getLooping = function () {
        return this.looping;
    };

    return {
        Skeleton: Skeleton
    }; 
}());