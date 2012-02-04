pc.anim.InterpolatedKey = function InterpolatedKey() {
    this._keyFrames = [];

    // Result of interpolation
    this._quat  = pc.math.quat.create(0, 0, 0, 0);
    this._pos   = pc.math.vec3.create(0, 0, 0);
    this._scale = pc.math.vec3.create(0, 0, 0);

    // Optional destination for interpolated keyframe
    this._targetNode = null;
}

pc.anim.InterpolatedKey.prototype.getTarget = function () {
    return this._targetNode;
}

pc.anim.InterpolatedKey.prototype.setTarget = function (node) {
    this._targetNode = node;
}

pc.extend(pc.anim, function () {
    /**
     * @name pc.anim.Skeleton
     * @class A skeleton.
     */
    var Skeleton = function Skeleton(numNodes) {
        this._animation = null;
        this._time = 0;
        this._interpolatedKeys = [];
        this._currKeyIndices = [];
        for (var i = 0; i < numNodes; i++) {
            this._interpolatedKeys[i] = new pc.anim.InterpolatedKey();
            this._currKeyIndices[i] = 0;
        }
        this.looping = true;
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
            
            var nodes = this._animation.getNodes();

            // Step the current time and work out if we need to jump ahead, clamp or wrap around
            this._time += delta;
            var duration = this._animation.getDuration();
            if (this._time > duration) {
                this._time = this.looping ? 0.0 : duration;
                for (i = 0; i < nodes.length; i++) {
                    this._currKeyIndices[i] = 0;
                }
            }

            for (i = 0; i < nodes.length; i++) {
                var keys = nodes[i];

                // Find keyframe pair
                if (keys.length === 1) {
                    pc.math.quat.copy(keys[0]._quat, this._interpolatedKeys[i]._quat);
                    pc.math.vec3.copy(keys[0]._pos, this._interpolatedKeys[i]._pos);
                    pc.math.vec3.copy(keys[0]._scale, this._interpolatedKeys[i]._scale);
                } else {
                    for (var currKeyIndex = this._currKeyIndices[i]; currKeyIndex < keys.length-1; currKeyIndex++) {
                        var k1 = keys[currKeyIndex];
                        var k2 = keys[currKeyIndex + 1];

                        if ((k1._time <= this._time) && (k2._time >= this._time)) {
                            var alpha = (this._time - k1._time) / (k2._time - k1._time);

                            qslerp(k1._quat, k2._quat, alpha, this._interpolatedKeys[i]._quat);
                            vlerp(k1._pos, k2._pos, alpha, this._interpolatedKeys[i]._pos);
                            vlerp(k1._scale, k2._scale, alpha, this._interpolatedKeys[i]._scale);

                            this._currKeyIndices[i] = currKeyIndex;
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
            pc.math.quat.slerp(skel1._interpolatedKeys[i]._quat, skel2._interpolatedKeys[i]._quat, alpha, this._interpolatedKeys[i]._quat);
            pc.math.vec3.lerp(skel1._interpolatedKeys[i]._pos, skel2._interpolatedKeys[i]._pos, alpha, this._interpolatedKeys[i]._pos);
            pc.math.vec3.lerp(skel1._interpolatedKeys[i]._scale, skel2._interpolatedKeys[i]._scale, alpha, this._interpolatedKeys[i]._scale);
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
    }

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
            this._currKeyIndices[i] = 0;
        }
    }

    /**
     * @function
     * @name pc.anim.Skeleton#getNumNodes
     * @description Returns the number of nodes held by the specified skeleton.
     * @returns {Number} The number of nodes held by the specified skeleton.
     * @author Will Eastcott
     */
    Skeleton.prototype.getNumNodes = function () {
        return this._interpolatedKeys.length;
    }
    
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
        var nodeIndex = 0;
        var setGraph = function(skeleton, node) {
            skeleton._interpolatedKeys[nodeIndex++].setTarget(node);
            var children = node.getChildren();
            for (var i = 0; i < children.length; i++) {
                setGraph(skeleton, children[i]);
            }
        }
        setGraph(this, graph);
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
        logASSERT((this._animation !== null), "Skeleton requires an animation in order to update a scene graph");

        var nodes = this._animation.getNodes();
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].length > 0) {
                var interpKey = this._interpolatedKeys[i];

                var ltm = interpKey.getTarget().getLocalTransform();
                pc.math.quat.toMat4(interpKey._quat, ltm);
                ltm[0] *= interpKey._scale[0];
                ltm[4] *= interpKey._scale[0];
                ltm[8] *= interpKey._scale[0];
                ltm[1] *= interpKey._scale[1];
                ltm[5] *= interpKey._scale[1];
                ltm[9] *= interpKey._scale[1];
                ltm[2] *= interpKey._scale[2];
                ltm[6] *= interpKey._scale[2];
                ltm[10] *= interpKey._scale[2];
                ltm[12] = interpKey._pos[0];
                ltm[13] = interpKey._pos[1];
                ltm[14] = interpKey._pos[2];
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