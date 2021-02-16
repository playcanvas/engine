import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

class InterpolatedKey {
    constructor() {
        this._written = false;
        this._name = "";
        this._keyFrames = [];

        // Result of interpolation
        this._quat = new Quat();
        this._pos = new Vec3();
        this._scale = new Vec3();

        // Optional destination for interpolated keyframe
        this._targetNode = null;
    }

    getTarget() {
        return this._targetNode;
    }

    setTarget(node) {
        this._targetNode = node;
    }
}

/**
 * @class
 * @name Skeleton
 * @classdesc Represents a skeleton used to play animations.
 * @param {GraphNode} graph - The root pc.GraphNode of the skeleton.
 * @property {boolean} looping Determines whether skeleton is looping its animation.
 */
class Skeleton {
    constructor(graph) {
        this._animation = null;
        this._time = 0;
        this.looping = true;

        this._interpolatedKeys = [];
        this._interpolatedKeyDict = {};
        this._currKeyIndices = {};

        this.graph = null;

        var self = this;

        function addInterpolatedKeys(node) {
            var interpKey = new InterpolatedKey();
            interpKey._name = node.name;
            self._interpolatedKeys.push(interpKey);
            self._interpolatedKeyDict[node.name] = interpKey;
            self._currKeyIndices[node.name] = 0;

            for (var i = 0; i < node._children.length; i++)
                addInterpolatedKeys(node._children[i]);
        }

        addInterpolatedKeys(graph);
    }

    /**
     * @name Skeleton#animation
     * @type {pc.Animation}
     * @description Animation currently assigned to skeleton.
     */
    get animation() {
        return this._animation;
    }

    set animation(value) {
        this._animation = value;
        this.currentTime = 0;
    }

    /**
     * @name Skeleton#currentTime
     * @type {number}
     * @description Current time of currently active animation in seconds.
     * This value is between zero and the duration of the animation.
     */
    get currentTime() {
        return this._time;
    }

    set currentTime(value) {
        this._time = value;
        var numNodes = this._interpolatedKeys.length;
        for (var i = 0; i < numNodes; i++) {
            var node = this._interpolatedKeys[i];
            var nodeName = node._name;
            this._currKeyIndices[nodeName] = 0;
        }

        this.addTime(0);
        this.updateGraph();
    }

    /**
     * @readonly
     * @name Skeleton#numNodes
     * @type {number}
     * @description Read-only property that returns number of nodes of a skeleton.
     */
    get numNodes() {
        return this._interpolatedKeys.length;
    }

    /**
     * @function
     * @name Skeleton#addTime
     * @description Progresses The animation assigned to The specified skeleton by The
     * supplied time delta. If the delta takes the animation passed its end point, if
     * the skeleton is set to loop, the animation will continue from the beginning.
     * Otherwise, the animation's current time will remain at its duration (i.e. the
     * end).
     * @param {number} delta - The time in seconds to progress the skeleton's animation.
     */
    addTime(delta) {
        if (this._animation !== null) {
            var i;
            var node, nodeName;
            var keys, interpKey;
            var k1, k2, alpha;
            var nodes = this._animation._nodes;
            var duration = this._animation.duration;

            // Check if we can early out
            if ((this._time === duration) && !this.looping) {
                return;
            }

            // Step the current time and work out if we need to jump ahead, clamp or wrap around
            this._time += delta;

            if (this._time > duration) {
                this._time = this.looping ? 0.0 : duration;
                for (i = 0; i < nodes.length; i++) {
                    node = nodes[i];
                    nodeName = node._name;
                    this._currKeyIndices[nodeName] = 0;
                }
            } else if (this._time < 0) {
                this._time = this.looping ? duration : 0.0;
                for (i = 0; i < nodes.length; i++) {
                    node = nodes[i];
                    nodeName = node._name;
                    this._currKeyIndices[nodeName] = node._keys.length - 2;
                }
            }


            // For each animated node...

            // keys index offset
            var offset = (delta >= 0 ? 1 : -1);

            var foundKey;
            for (i = 0; i < nodes.length; i++) {
                node = nodes[i];
                nodeName = node._name;
                keys = node._keys;

                // Determine the interpolated keyframe for this animated node
                interpKey = this._interpolatedKeyDict[nodeName];
                if (interpKey === undefined) {
                    // #ifdef DEBUG
                    console.warn('Unknown skeleton node name: ' + nodeName);
                    // #endif
                    continue;
                }
                // If there's only a single key, just copy the key to the interpolated key...
                foundKey = false;
                if (keys.length !== 1) {
                    // Otherwise, find the keyframe pair for this node
                    for (var currKeyIndex = this._currKeyIndices[nodeName]; currKeyIndex < keys.length - 1 && currKeyIndex >= 0; currKeyIndex += offset) {
                        k1 = keys[currKeyIndex];
                        k2 = keys[currKeyIndex + 1];

                        if ((k1.time <= this._time) && (k2.time >= this._time)) {
                            alpha = (this._time - k1.time) / (k2.time - k1.time);

                            interpKey._pos.lerp(k1.position, k2.position, alpha);
                            interpKey._quat.slerp(k1.rotation, k2.rotation, alpha);
                            interpKey._scale.lerp(k1.scale, k2.scale, alpha);
                            interpKey._written = true;

                            this._currKeyIndices[nodeName] = currKeyIndex;
                            foundKey = true;
                            break;
                        }
                    }
                }
                if (keys.length === 1 || (!foundKey && this._time === 0.0 && this.looping)) {
                    interpKey._pos.copy(keys[0].position);
                    interpKey._quat.copy(keys[0].rotation);
                    interpKey._scale.copy(keys[0].scale);
                    interpKey._written = true;
                }
            }
        }
    }

    /**
     * @function
     * @name Skeleton#blend
     * @description Blends two skeletons together.
     * @param {Skeleton} skel1 - Skeleton holding the first pose to be blended.
     * @param {Skeleton} skel2 - Skeleton holding the second pose to be blended.
     * @param {number} alpha - The value controlling the interpolation in relation to the two input
     * skeletons. The value is in the range 0 to 1, 0 generating skel1, 1 generating skel2 and anything
     * in between generating a spherical interpolation between the two.
     */
    blend(skel1, skel2, alpha) {
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
    }

    /**
     * @function
     * @name Skeleton#setGraph
     * @description Links a skeleton to a node hierarchy. The nodes animated skeleton are
     * then subsequently used to drive the local transformation matrices of the node
     * hierarchy.
     * @param {GraphNode} graph - The root node of the graph that the skeleton is to drive.
     */
    setGraph(graph) {
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
    }

    /**
     * @function
     * @name Skeleton#updateGraph
     * @description Synchronizes the currently linked node hierarchy with the current state of the
     * skeleton. Internally, this function converts the interpolated keyframe at each node in the
     * skeleton into the local transformation matrix at each corresponding node in the linked node
     * hierarchy.
     */
    updateGraph() {
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
    }
}

export { Skeleton };
