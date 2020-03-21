Object.assign(pc, function () {

    /**
     * @private
     * @constant
     * @type {number}
     * @name pc.INTERPOLATION_STEP
     * @description A stepped interpolation scheme.
     */
    var INTERPOLATION_STEP = 0;

    /**
     * @private
     * @constant
     * @type {number}
     * @name pc.INTERPOLATION_LINEAR
     * @description A linear interpolation scheme.
     */
    var INTERPOLATION_LINEAR = 1;

    /**
     * @private
     * @constant
     * @type {number}
     * @name pc.INTERPOLATION_CUBIC
     * @description A cubic spline interpolation scheme.
     */
    var INTERPOLATION_CUBIC = 2;

    /**
     * @private
     * @class
     * @name pc.AnimData
     * @classdesc Wraps a set of data used in animation.
     * @description Create a new animation data container.
     * @param {number} dimension - Specifies the number of components which make up an element
     * of data. For example, specify 3 for a set of 3-dimensional vectors. The number of elements
     * in data must be a multiple of dimension.
     * @param {Float32Array|number[]} data - The set of data
     */
    var AnimData = function (dimension, data) {
        this._dimension = dimension;
        this._data = data;
    };

    Object.defineProperties(AnimData.prototype, {
        dimension: {
            get: function () {
                return this._dimension;
            }
        },
        data: {
            get: function () {
                return this._data;
            }
        }
    });

    /**
     * @private
     * @class
     * @name pc.AnimCache
     * @classdesc Internal cache data for the evaluation of a single curve timeline.
     * @description Create a new animation cache.
     */
    var AnimCache = function () {
        // these members are calculated per-segment
        this._left = Infinity;      // time of left knot
        this._right = -Infinity;    // time of right knot
        this._len = 0;              // distance between current knots
        this._recip = 0;            // reciprocal len
        this._p0 = 0;               // index of the left knot
        this._p1 = 0;               // index of the right knot

        // these members are calculated per-time evaluation
        this._t = 0;                // normalized time
        this._hermite = {           // hermite weights, calculated on demand
            valid: false,
            p0: 0,
            m0: 0,
            p1: 0,
            m1: 0
        };
    };

    Object.assign(AnimCache.prototype, {
        update: function (time, input) {
            if (time < this._left || time >= this._right) {
                // recalculate knots
                var len = input.length;
                if (!len) {
                    // curve is empty
                    this._left = -Infinity;
                    this._right = Infinity;
                    this._len = 0;
                    this._recip = 0;
                    this._p0 = this._p1 = 0;
                } else {
                    if (time < input[0]) {
                        // time falls before the first key
                        this._left = -Infinity;
                        this._right = input[0];
                        this._len = 0;
                        this._recip = 0;
                        this._p0 = this._p1 = 0;
                    } else if (time >= input[len - 1]) {
                        // time falls after the last key
                        this._left = input[len - 1];
                        this._right = Infinity;
                        this._len = 0;
                        this._recip = 0;
                        this._p0 = this._p1 = len - 1;
                    } else {
                        // time falls within the bounds of the curve
                        var index = this._findKey(time, input);
                        this._left = input[index];
                        this._right = input[index + 1];
                        this._len = this._right - this._left;
                        var diff = 1.0 / this._len;
                        this._recip = (isFinite(diff) ? diff : 0);
                        this._p0 = index;
                        this._p1 = index + 1;
                    }
                }
            }

            // calculate normalized time
            this._t = (this._recip === 0) ? 0 : ((time - this._left) * this._recip);
            this._hermite.valid = false;
        },

        _findKey: function (time, input) {
            // TODO: start the search around the currently selected knots
            var index = 0;
            while (time >= input[index + 1]) {
                index++;
            }
            return index;
        },

        // evaluate the output anim data at the current time
        eval: function (result, interpolation, output) {
            var data = output._data;
            var dim = output._dimension;
            var idx0 = this._p0 * dim;
            var i;

            if (interpolation === pc.INTERPOLATION_STEP) {
                for (i = 0; i < dim; ++i) {
                    result[i] = data[idx0 + i];
                }
            } else {
                var t = this._t;
                var idx1 = this._p1 * dim;

                switch (interpolation) {
                    case pc.INTERPOLATION_LINEAR:
                        for (i = 0; i < dim; ++i) {
                            result[i] = pc.math.lerp(data[idx0 + i], data[idx1 + i], t);
                        }
                        break;

                    case pc.INTERPOLATION_CUBIC:
                        var hermite = this._hermite;

                        if (!hermite.valid) {
                            // cache hermite weights
                            var t2 = t * t;
                            var twot = t + t;
                            var omt = 1 - t;
                            var omt2 = omt * omt;

                            hermite.valid = true;
                            hermite.p0 = (1 + twot) * omt2;
                            hermite.m0 = t * omt2;
                            hermite.p1 = t2 * (3 - twot);
                            hermite.m1 = t2 * (t - 1);
                        }

                        var p0 = (this._p0 * 3 + 1) * dim;     // point at k
                        var m0 = (this._p0 * 3 + 2) * dim;     // out-tangent at k
                        var p1 = (this._p1 * 3 + 1) * dim;     // point at k + 1
                        var m1 = (this._p1 * 3 + 0) * dim;     // in-tangent at k + 1

                        for (i = 0; i < dim; ++i) {
                            result[i] = hermite.p0 * data[p0 + i] +
                                        hermite.m0 * data[m0 + i] * this._len +
                                        hermite.p1 * data[p1 + i] +
                                        hermite.m1 * data[m1 + i] * this._len;
                        }
                        break;
                }
            }
        }
    });

    /**
     * @private
     * @class
     * @name pc.AnimCurve
     * @classdesc Animation curve links an input data set to an output data set
     * and defines the interpolation method to use.
     * @description Create a new animation curve
     * @param {number} input - index of the curve which specifies the key data.
     * @param {number} output - index of the curve which specifies the value data.
     * @param {number} interpolation - the interpolation method to use. One of the following:
     *
     * * {@link pc.INTERPOLATION_STEP}
     * * {@link pc.INTERPOLATION_LINEAR}
     * * {@link pc.INTERPOLATION_CUBIC}
     *
     */
    var AnimCurve = function (input, output, interpolation) {
        this._input = input;
        this._output = output;
        this._interpolation = interpolation;
    };

    /**
     * @private
     * @class
     * @name pc.AnimTarget
     * @classdesc AnimTarget names a target graph node and specifies the curves which drive translation, rotation and scale.
     * @description Create a new animation target.
     * @param {string} name - the target node to control.
     * @param {number} translation - the curve index controlling the translation of the target node or -1 for none.
     * @param {number} rotation - the curve index controlling the rotation of the target node or -1 for none.
     * @param {number} scale - the curve index controlling the scale of the target node or -1 for none.
     */
    var AnimTarget = function (name, translation, rotation, scale) {
        this._name = name;
        this._translation = translation;
        this._rotation = rotation;
        this._scale = scale;
    };

    Object.defineProperties(AnimTarget.prototype, {
        name: {
            get: function () {
                return this._name;
            }
        },
        translation: {
            get: function () {
                return this._translation;
            }
        },
        rotation: {
            get: function () {
                return this._rotation;
            }
        },
        scale: {
            get: function () {
                return this._scale;
            }
        }
    });

    /**
     * @private
     * @class
     * @name pc.AnimTrack
     * @classdesc AnimTrack contains a set of curve data which can be used to animate a set of target nodes.
     * @description Create a new animation track.
     * @param {string} name - the track name
     * @param {number} duration - the duration of the track in seconds.
     * @param {pc.AnimData[]} inputs - list of curve key data.
     * @param {pc.AnimData[]} outputs - list of curve value data.
     * @param {pc.AnimCurve[]} curves - the list of curves.
     * @param {pc.AnimTarget[]} targets - the list of targets.
     */
    var AnimTrack = function (name, duration, inputs, outputs, curves, targets) {
        this._name = name;
        this._duration = duration;
        this._inputs = inputs;
        this._outputs = outputs;
        this._curves = curves;
        this._targets = targets;
    };

    Object.defineProperties(AnimTrack.prototype, {
        name: {
            get: function () {
                return this._name;
            }
        },
        duration: {
            get: function () {
                return this._duration;
            }
        },
        targets: {
            get: function () {
                return this._targets;
            }
        }
    });

    Object.assign(AnimTrack.prototype, {
        // evaluate all track curves at the specified time and store results
        // in the provided snapshot.
        eval: function (time, snapshot) {
            snapshot._time = time;

            var inputs = this._inputs;
            var outputs = this._outputs;
            var curves = this._curves;
            var cache = snapshot._cache;
            var results = snapshot._results;

            var i;

            // evaluate inputs
            for (i = 0; i < inputs.length; ++i) {
                cache[i].update(time, inputs[i]._data);
            }

            // evalute outputs
            for (i = 0; i < curves.length; ++i) {
                var curve = curves[i];
                var output = outputs[curve._output];
                var result = results[i];
                cache[curve._input].eval(result, curve._interpolation, output);
            }
        }
    });

    /**
     * @private
     * @class
     * @name pc.AnimSnapshot
     * @classdesc AnimSnapshot stores the state of an animation track at a particular time.
     * @description Create a new animation snapshot.
     * @param {pc.AnimTrack} animTrack - the source track.
     */
    var AnimSnapshot = function (animTrack) {
        this._name = animTrack.name + 'Snapshot';
        this._time = -1;

        // per-curve input cache
        this._cache = [];

        // per-curve evaluation results
        this._results = [];

        var i;

        // pre-allocate input caches
        for (i = 0; i < animTrack._inputs.length; ++i) {
            this._cache[i] = new AnimCache();
        }

        // pre-allocate storage for evaluation results
        var curves = animTrack._curves;
        var outputs = animTrack._outputs;
        for (i = 0; i < curves.length; ++i) {
            var curve = curves[i];
            var output = outputs[curve._output];
            var storage = [];
            for (var j = 0; j < output._dimension; ++j) {
                storage[j] = 0;
            }
            this._results[i] = storage;
        }
    };

    /**
     * @private
     * @class
     * @name pc.AnimClip
     * @classdesc AnimClip wraps the running state of an animation track. It contains and update
     * the animation 'cursor' and performs looping logic.
     * @description Create a new animation clip.
     * @param {pc.AnimTrack} track - the animation data.
     * @param {number} time - the initial time of the clip.
     * @param {number} speed - speed of the animation playback.
     * @param {boolean} playing - true if the clip is playing and false otherwise.
     * @param {boolean} loop - whether the clip should loop.
     */
    // TODO: add configurable looping start/end times?
    var AnimClip = function (track, time, speed, playing, loop) {
        this._name = track.name;        // default to track name
        this._track = track;
        this._snapshot = new AnimSnapshot(track);
        this._playing = playing;
        this._time = time;              // play cursor
        this._speed = speed;
        this._loop = loop;
        this._blendWeight = 1.0;         // blend weight 0..1
    };

    Object.defineProperties(AnimClip.prototype, {
        name: {
            get: function () {
                return this._name;
            },
            set: function (name) {
                this._name = name;
            }
        },
        track: {
            get: function () {
                return this._track;
            }
        },
        snapshot: {
            get: function () {
                return this._snapshot;
            }
        },
        time: {
            get: function () {
                return this._time;
            },
            set: function (time) {
                this._time = time;
            }
        },
        speed: {
            get: function () {
                return this._speed;
            },
            set: function (speed) {
                this._speed = speed;
            }
        },
        loop: {
            get: function () {
                return this._loop;
            },
            set: function (loop) {
                this._loop = loop;
            }
        },
        blendWeight: {
            get: function () {
                return this._blendWeight;
            },
            set: function (blendWeight) {
                this._blendWeight = blendWeight;
            }
        }
    });

    Object.assign(AnimClip.prototype, {
        _update: function (deltaTime) {
            if (this._playing) {
                var time = this._time;
                var duration = this._track.duration;
                var speed = this._speed;
                var loop = this._loop;

                // update time
                time += speed * deltaTime;

                // perform looping
                if (speed >= 0) {
                    // playing forwards
                    if (time > duration) {
                        if (loop) {
                            time = (time % duration) || 0;  // if duration is 0, % is NaN
                        } else {
                            time = this._track.duration;
                            this.pause();
                        }
                    }
                } else {
                    // playing backwards
                    if (time < 0) {
                        if (loop) {
                            time = duration + ((time % duration) || 0);
                        } else {
                            time = 0;
                            this.pause();
                        }
                    }
                }
                this._time = time;
            }

            // update snapshot if time has changed
            if (this._time != this._snapshot._time) {
                this._track.eval(this._time, this._snapshot);
            }
        },

        play: function () {
            this._playing = true;
            this._time = 0;
        },

        stop: function () {
            this._playing = false;
            this._time = 0;
        },

        pause: function () {
            this._playing = false;
        },

        resume: function () {
            this._playing = true;
        },

        reset: function () {
            this._time = 0;
        }
    });

    /**
     * @private
     * @class
     * @name pc.AnimController
     * @classdesc AnimContoller stores a set of animation clips and performs blending
     * between them. It then applies the resulting transforms to the target nodes.
     * @description Create a new animation controller.
     * @param {pc.GraphNode} graph - root of the scene graph to control.
     */
    var AnimController = function (graph) {

        var nodesMap = { };
        var nodes = [];
        var basePose = [];
        var activeNodes = [];

        var flatten = function (node) {
            var p = node.localPosition;
            var r = node.localRotation;
            var s = node.localScale;
            nodesMap[node.name] = nodes.length;
            nodes.push(node);
            basePose.splice(basePose.length, 0, p.x, p.y, p.z, r.x, r.y, r.z, r.w, s.x, s.y, s.z);
            activeNodes.push(0);

            for (var i = 0; i < node.children.length; ++i) {
                flatten(node.children[i]);
            }
        };
        flatten(graph);

        this._nodesMap = nodesMap;              // node name -> index
        this._nodes = nodes;                    // list of nodes
        this._basePose = basePose;              // list of bind pose data
        this._activePose = basePose.slice();
        this._activeNodes = activeNodes;        // store per-node active curves (those with 0 can be skipped)
        this._clips = [];

        this._q0 = new pc.Quat();
        this._q1 = new pc.Quat();
    };

    Object.defineProperties(AnimController.prototype, {
        'numClips': {
            get: function () {
                return this._clips.length;
            }
        }
    });

    Object.assign(AnimController.prototype, {
        addClip: function (clip) {
            var targets = clip.track.targets;
            var snapshot = clip.snapshot;
            var nodesMap = this._nodesMap;

            var i;

            // create links between the target nodes and their corresponding animation curves for t, r, s
            var links = [];
            for (i = 0; i < targets.length; ++i) {
                var target = targets[i];
                var name = target.name;
                if (nodesMap.hasOwnProperty(name)) {
                    var link = {
                        node: nodesMap[name],
                        translation: target.translation !== -1 ? snapshot._results[target.translation] : null,
                        rotation: target.rotation !== -1 ? snapshot._results[target.rotation] : null,
                        scale: target.scale !== -1 ? snapshot._results[target.scale] : null
                    };
                    if (link.translation || link.rotation || link.scale) {
                        links.push(link);
                    }
                }
            }

            // add clip
            this._clips.push({
                clip: clip,
                links: links
            });

            // count per-node active curves
            var activeNodes = this._activeNodes;
            for (i = 0; i < links.length; ++i) {
                activeNodes[links[i].node]++;
            }
        },

        removeClip: function (index) {
            // decrement node drivers
            var links = this._clips[index].links;
            var activeNodes = this._activeNodes;
            var basePose = this._basePose;
            var activePose = this._activePose;
            for (var i = 0; i < links.length; ++i) {
                var node = links[i].node;
                activeNodes[node]--;

                // if the node is no longer driven by a clip as a result
                // of this removal, then we must reset the tree to the
                // base pose
                if (activeNodes[node] === 0) {
                    for (var j = 0; j < 10; ++j) {
                        activePose[i * 10 + j] = basePose[i * 10 + j];
                    }
                    this._applyActive(node);
                }
            }

            // remove clip
            this._clips.splice(index, 1);
        },

        removeClips: function () {
            while (this.numClips > 0) {
                this.removeClip(0);
            }
        },

        getClip: function (index) {
            return this._clips[index].clip;
        },

        findClip: function (name) {
            for (var i = 0; i < this._clips.length; ++i) {
                if (this._clips[i].name === name) {
                    return this._clips[i].clip;
                }
            }
            return null;
        },

        update: function (deltaTime) {
            var clips = this._clips;
            var nodes = this._nodes;
            var activeNodes = this._activeNodes;
            var basePose = this._basePose;
            var activePose = this._activePose;

            var i, j, c;

            // reset base pose on active nodes
            for (i = 0; i < nodes.length; ++i) {
                if (activeNodes[i] > 0) {
                    for (j = 0; j < 10; ++j) {
                        activePose[i * 10 + j] = basePose[i * 10 + j];
                    }
                }
            }

            // blend animation clips onto the activePose
            for (c = 0; c < clips.length; ++c) {
                var clip = clips[c];
                var links = clip.links;

                // update animation clip
                clip.clip._update(deltaTime);

                var weight = clip.clip.blendWeight;
                if (weight >= 1.0) {
                    // overwrite active pose
                    for (i = 0; i < links.length; ++i) {
                        this._setActive(links[i]);
                    }
                } else if (weight > 0) {
                    // blend onto active pose
                    for (i = 0; i < links.length; ++i) {
                        this._blendActive(links[i], weight);
                    }
                } // skip clips with weight <= 0
            }

            // apply the activePose to the node hierarchy
            for (i = 0; i < nodes.length; ++i) {
                if (activeNodes[i] > 0) {
                    this._applyActive(i);
                }
            }
        },

        // set the link's t, r, s on the active pose node
        _setActive: function (link) {
            var activePose = this._activePose;
            var idx = link.node * 10;
            var t = link.translation;
            var r = link.rotation;
            var s = link.scale;
            var i;

            if (t) {
                for (i = 0; i < 3; ++i) {
                    activePose[idx + i] = t[i];
                }
            }
            if (r) {
                this._q0.set(r[0], r[1], r[2], r[3]);
                this._q0.normalize();

                activePose[idx + 3 + 0] = this._q0.x;
                activePose[idx + 3 + 1] = this._q0.y;
                activePose[idx + 3 + 2] = this._q0.z;
                activePose[idx + 3 + 3] = this._q0.w;
            }
            if (s) {
                for (i = 0; i < 3; ++i) {
                    activePose[idx + 7 + i] = s[i];
                }
            }
        },

        // blend the link's t, r, s onto the active pose node
        _blendActive: function (link, weight) {
            var oneMinusWeight = 1.0 - weight;
            var activePose = this._activePose;
            var idx = link.node * 10;
            var t = link.translation;
            var r = link.rotation;
            var s = link.scale;
            var i;

            if (t) {
                for (i = 0; i < 3; ++i) {
                    activePose[idx + i] = activePose[idx + i] * oneMinusWeight + t[i] * weight;
                }
            }

            if (r) {
                this._q0.set(activePose[idx + 3], activePose[idx + 4], activePose[idx + 5], activePose[idx + 6]);
                this._q1.set(r[0], r[1], r[2], r[3]);
                this._q1.normalize();
                this._q0.slerp(this._q0, this._q1, weight);

                activePose[idx + 3 + 0] = this._q0.x;
                activePose[idx + 3 + 1] = this._q0.y;
                activePose[idx + 3 + 2] = this._q0.z;
                activePose[idx + 3 + 3] = this._q0.w;
            }

            if (s) {
                for (i = 0; i < 3; ++i) {
                    activePose[idx + 7 + i] = activePose[idx + 7 + i] * oneMinusWeight + s[i] * weight;
                }
            }
        },

        // apply the active node transform to the target
        _applyActive: function (nodeIndex) {
            var activePose = this._activePose;
            var node = this._nodes[nodeIndex];
            var idx = nodeIndex * 10;

            node.localPosition.set(activePose[idx++], activePose[idx++], activePose[idx++]);
            node.localRotation.set(activePose[idx++], activePose[idx++], activePose[idx++], activePose[idx++]);
            node.localScale.set(activePose[idx++], activePose[idx++], activePose[idx++]);

            // TODO: decide at what point to renormalize quaternions, options are:
            // after curve evaluation
            // after link blending
            // right at the end
            // all of the above

            // TODO: is this the optimal way of dirtifying the hierarchy?
            node._dirtifyLocal();
        }
    });

    return {
        INTERPOLATION_STEP: INTERPOLATION_STEP,
        INTERPOLATION_LINEAR: INTERPOLATION_LINEAR,
        INTERPOLATION_CUBIC: INTERPOLATION_CUBIC,
        AnimData: AnimData,
        AnimCurve: AnimCurve,
        AnimTarget: AnimTarget,
        AnimTrack: AnimTrack,
        AnimSnapshot: AnimSnapshot,
        AnimClip: AnimClip,
        AnimController: AnimController
    };
}());
