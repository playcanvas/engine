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
        for (var i = 0; i < numNodes; i++) {
            this._interpolatedKeys[i] = new pc.anim.InterpolatedKey();
        }
        this.looping = true;
    };

    /**
     * @function
     * @name pc.anim.Skeleton#addTime
     * @description
     * @param {number} delta
     * @author Will Eastcott
     */
    Skeleton.prototype.addTime = function (delta) {
        if (this._animation !== null) {
            this._time += delta;
            var duration = this._animation.getDuration();
            if (this._time > duration) {
                this._time = this.looping ? 0.0 : duration;
            }

            var nodes = this._animation.getNodes();
            for (var i = 0; i < nodes.length; i++) {
                var keys = nodes[i];

                // Find keyframe pair
                for (var currKeyIndex = 0; currKeyIndex < keys.length-1; currKeyIndex++) {
                    var k1 = keys[currKeyIndex];
                    var k2 = keys[currKeyIndex + 1];

                    if ((k1._time <= this._time) && (k2._time >= this._time)) {
                        var alpha = (this._time - k1._time) / (k2._time - k1._time);

                        pc.math.quat.slerp(k1._quat, k2._quat, alpha, this._interpolatedKeys[i]._quat);
                        pc.math.vec3.lerp(k1._pos, k2._pos, alpha, this._interpolatedKeys[i]._pos);
                        pc.math.vec3.lerp(k1._scale, k2._scale, alpha, this._interpolatedKeys[i]._scale);
                    }
                }
            }
        }
    };

    /**
     * @function
     * @name pc.anim.Skeleton#blend
     * @description Blends two skeletons together.
     * @param {pc.anim.Skeleton} a Skeleton holding the first pose to be blended.
     * @param {pc.anim.Skeleton} b Skeleton holding the second pose to be blended.
     * @author Will Eastcott
     */
    Skeleton.prototype.blend = function (a, b, alpha) {
        var numNodes = this._interpolatedKeys.length;
        for (var i = 0; i < numNodes; i++) {
            pc.math.quat.slerp(a._interpolatedKeys[i]._quat, b._interpolatedKeys[i]._quat, alpha, this._interpolatedKeys[i]._quat);
            pc.math.vec3.lerp(a._interpolatedKeys[i]._pos, b._interpolatedKeys[i]._pos, alpha, this._interpolatedKeys[i]._pos);
            pc.math.vec3.lerp(a._interpolatedKeys[i]._scale, b._interpolatedKeys[i]._scale, alpha, this._interpolatedKeys[i]._scale);
        }
    };
    
    /**
     * @function
     * @name pc.anim.Skeleton#getAnimation
     * @description
     * @returns {pc.anim.Animation}
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
     * @returns {number} The current time of the animation set on the skeleton.
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
     * @param {number} The current time of the animation set on the skeleton.
     * @author Will Eastcott
     */
    Skeleton.prototype.setCurrentTime = function (time) {
        this._time = time;
    }

    /**
     * @function
     * @name pc.anim.Skeleton#getNumNodes
     * @description Returns the number of nodes held by the specified skeleton.
     * @returns {number} The number of nodes held by the specified skeleton.
     * @author Will Eastcott
     */
    Skeleton.prototype.getNumNodes = function () {
        return this._interpolatedKeys.length;
    }
    
    /**
     * @function
     * @name pc.anim.Skeleton#setAnimation
     * @description
     * @param {pc.anim.Animation} animation
     * @author Will Eastcott
     */
    Skeleton.prototype.setAnimation = function (animation) {
        this._animation = animation;
        this._time = 0;
    };

    /**
     * @function
     * @name pc.anim.Skeleton#setGraph
     * @description
     * @param {pc.scene.GraphNode} graph
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
     * @description
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
     * @param looping {boolean}
     * @description
     * @author Will Eastcott
     */
    Skeleton.prototype.setLooping = function (looping) {
        this.looping = looping;
    };

    /**
     * @function
     * @name pc.anim.Skeleton#getLooping
     * @return {boolean}
     * @description
     * @author Will Eastcott
     */
    Skeleton.prototype.getLooping = function () {
        return this.looping;
    };

    return {
        Skeleton: Skeleton
    }; 
}());