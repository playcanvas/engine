Object.assign(pc, function () {

    // animation interpolation type
    var AnimInterpolation = {
        STEP: 0,
        LINEAR: 1,
        CUBIC: 2
    };

    // animation data
    //
    // blob of animation which wraps a set of either times(/keys) or animation
    // values
    var AnimData = function (dimension, data) {
        this._dimension = dimension;
        this._data = data;
    };

    // cache data for the evaluation of a single curve
    var AnimCache = function () {
        // these members are calculated per-segment
        this._left = Infinity;     // time of left knot
        this._right = -Infinity;     // time of right knot
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
            m1: 0,
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
                    } else if (time > input[len - 1]) {
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
            this._t = (time - this._left) * this._recip;
            this._hermiteValid = false;
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
            var p0 = this._p0 * dim;

            if (interpolation === AnimInterpolation.STEP) {
                for (var i=0; i<dim; ++i) {
                    result[i] = data[p0 + i];
                }
            } else {
                var t = this._t;
                var p1 = this._p1 * dim;

                switch (interpolation) {
                    case AnimInterpolation.LINEAR:
                        for (var i=0; i<dim; ++i) {
                            result[i] = pc.math.lerp(data[p0 + i], data[p1 + i], t);
                        }
                        break;

                    case AnimInterpolation.CUBIC:
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

                        for (var i=0; i<dim; ++i) {
                            result[i] = hermite.p0 * data[p0 + i] +
                                        hermite.m0 * data[m0 + i] * this._tlen + 
                                        hermite.p1 * data[p1 + i] +
                                        hermite.m1 * data[m1 + i] * this._tlen;
                        }
                        break;
                }
            }
        }
    });

    // animation curve
    //
    // links an input data set with an output data set and defines the interpolation method
    var AnimCurve = function (input, output, interpolation) {
        this._input = input;
        this._output = output;
        this._interpolation = interpolation;
    };

    // animation target
    //
    // names a target node and specifies the curves for t, r, s
    var AnimTarget = function (name, translation, rotation, scale) {
        this._name = name;
        this._translation = translation;
        this._rotation = rotation;
        this._scale = scale;
    };

    Object.defineProperties(AnimTarget.prototype, {
        name: {
            get: function() { return this._name; }
        },
        translation: {
            get: function() { return this._translation; }
        },
        rotation: {
            get: function () { return this._rotation; }
        },
        scale: {
            get: function() { return this._scale; }
        }
    });

    // animation track
    //
    // stores the data required to evaluate a list of curves
    var AnimTrack = function (name, duration, inputs, outputs, curves, targets) {
        this._name = name;
        this._duration = duration;
        this._inputs = inputs;
        this._outputs = outputs;
        this._curves = curves;
        this._targets = targets;
    };

    Object.defineProperties(AnimTrack.prototype, {
        'name': {
            get: function () { return this._name; }
        },
        'duration': {
            get: function () { return this._duration; }
        },
        'targets': {
            get: function () { return this._targets; }
        }
    });

    Object.assign(AnimTrack.prototype, {
        // evaluate all the curves in the track at the specified time and store
        // results in the snapshot instance.
        eval: function (time, snapshot) {
            snapshot._time = time;

            var inputs = this._inputs;
            var outputs = this._outputs;
            var curves = this._curves;
            var cache = snapshot._cache;
            var results = snapshot._results;

            // evaluate inputs on the snapshot cache
            for (var i=0; i<inputs.length; ++i) {
                cache[i].update(time, inputs[i]._data);
            }

            // evalute curve outputs
            for (var i=0; i<curves.length; ++i) {
                var curve = curves[i];
                var output = outputs[curve._output];
                var result = results[i];
                cache[curve._input].eval(result, curve._interpolation, output);
            }
        }
    });

    // animation snapshot
    //
    // stores the state of an animation track at a particular time
    var AnimSnapshot = function (animTrack) {
        this._name = animTrack.name + 'Snapshot';
        this._time = -1;

        // input cache structure per curve
        this._cache = [];

        // contains evaluation results
        this._results = [];

        // pre-allocate input caches
        for (var i=0; i<animTrack._inputs.length; ++i) {
            this._cache[i] = new AnimCache();
        }

        // pre-allocate storage for evaluation results
        var curves = animTrack._curves;
        var outputs = animTrack._outputs;
        for (var i=0; i<curves.length; ++i) {
            var curve = curves[i];
            var output = outputs[curve._output];
            var storage = [];
            for (var j=0; j<output._dimension; ++j) {
                storage[j] = 0;
            }
            this._results[i] = storage;
        }
    };

    // animation clip
    // 
    // stores the running state of an animation track
    // TODO: add configurable looping start/end times?
    var AnimClip = function (track, time, playing, speed, loop) {
        this._track = track;
        this._snapshot = new AnimSnapshot(track);
        this._playing = playing;
        this._time = time;          // play cursor
        this._eval = -1;            // evaluation time
        this._speed = speed;
        this._loop = loop;
        this._weight = 1.0;         // blend weight 0..1
    };

    Object.defineProperties(AnimClip.prototype, {
        'name': {
            get: function () { return this._track._name; }
        },
        'track': {
            get: function () { return this._track; }
        },
        'snapshot': {
            get: function () { return this._snapshot; }
        },
        'time': {
            get: function () { return this._time; },
            set: function (time) { this._time = time; }
        },
        'speed': {
            get: function () { return this._speed; },
            set: function (speed) { this._speed = speed; }
        },
        'loop': {
            get: function () { return this._loop; },
            set: function (loop) { this._loop = loop; }
        },
        'weight': {
            get: function () { return this._weight; },
            set: function (weight) { this._weight = weight; }
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
                            time = time % duration;
                        } else {
                            time = this._track.duration;
                            this._pause();
                        }
                    }
                } else {
                    // playing backwards
                    if (time < 0) {
                        if (loop) {
                            time = duration + (time % duration);
                        } else {
                            time = 0;
                            this._pause();
                        }
                    }
                }
                this._time = time;
            }

            // if time has changed, update snapshot
            if (this._time != this._eval) {
                this._eval = this._time;
                this._track.eval(this._eval, this._snapshot);
            }
        },

        play: function () {
            this._playing = true;
            this._time = 0;
        },

        stop: function() {
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

    // animation controller
    // 
    // stores a set of clips and blends between them
    var AnimController = function (graph) {

        // build list of skeleton nodes
        var nodesMap = { };
        var nodes = [ ];
        var nodeDrivers = [ ];
        var basePose = [ ];

        var flatten = function (node) {
            var p = node.localPosition;
            var r = node.localRotation;
            var s = node.localScale;
            nodesMap[node.name] = nodes.length;
            nodes.push(node);
            nodeDrivers.push(0);
            basePose.splice(basePose.length, 0, p.x, p.y, p.z, r.x, r.y, r.z, r.w, s.x, s.y, s.z);

            for (var i=0; i<node.children.length; ++i) {
                flatten(node.children[i]);
            }
        };
        flatten(graph);

        this._nodesMap = nodesMap;              // node name -> index
        this._nodes = nodes;                    // list of nodes
        this._nodeDrivers = nodeDrivers;        // number of curves applied to each node (those with 0 can be skipped)
        this._basePose = basePose;              // list of bind pose data
        this._activePose = basePose.slice();
        this._clips = [ ];
    };

    Object.assign(AnimController.prototype, {
        addClip: function (clip) {
            var targets = clip.track.targets;
            var snapshot = clip.snapshot;
            var nodesMap = this._nodesMap;

            // create links between the target node and animation curve outputs for t, r, s
            var links = [ ];
            for (var i=0; i<targets.length; ++i) {
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

            // increment node drivers
            var nodeDrivers = this._nodeDrivers;
            for (var i=0; i<links.length; ++i) {
                nodeDrivers[links[i].node]++;
            }
        },

        numClips: function () {
            return this._clips.length;
        },

        removeClip: function (index) {
            // decrement node drivers
            var links = this._clips[index].links;
            var nodeDrivers = this._nodeDrivers;
            var basePose = this._basePose;
            var activePose = this._activePose;
            for (var i=0; i<links.length; ++i) {
                var node = links[i].node;
                nodeDrivers[node]--;

                // if the node is no longer driven by a clip as a result 
                // of this removal, then we must reset the tree to the
                // base pose
                if (nodeDrivers[node] === 0) {
                    for (var j=0; j<10; ++j) {
                        activePose[i*10+j] = basePose[i*10+j];
                    }
                    this._applyActiveNodeToTree(node);
                }
            }

            // remove clip
            this._clips.splice(index, 1);
        },

        getClip: function (index) {
            return this._clips[index].clip;
        },

        findClip: function (name) {
            for (var i=0; i<this._clips.length; ++i) {
                if (this._clips[i].name === name) {
                    return this._clips[i].clip;
                }
            }
            return null;
        },

        update: function (deltaTime) {
            var clips = this._clips;
            var nodes = this._nodes;
            var nodeDrivers = this._nodeDrivers;
            var basePose = this._basePose;
            var activePose = this._activePose;

            // reset base pose on active nodes
            for (var i=0; i<nodes.length; ++i) {
                if (nodeDrivers[i] > 0) {
                    for (var j=0; j<10; ++j) {
                        activePose[i*10+j] = basePose[i*10+j];
                    }
                }
            }

            // blend animation clips onto the activePose
            for (var c=0; c<clips.length; ++c) {
                var clip = clips[c];
                var links = clip.links;

                // update animation clip
                clip.clip._update(deltaTime);

                var weight = clip.clip.weight;
                if (weight >= 1.0) {
                    // overwrite active pose
                    for (var i=0; i<links.length; ++i) {
                        this._setActive(links[i]);
                    }
                } else if (weight > 0) {
                    // blend onto active pose
                    var oneMinusWeight = 1.0 - weight;
                    for (var i=0; i<links.length; ++i) {
                        this._blendActive(links[i], weight, oneMinusWeight);
                    }
                }
            }

            // apply activePose to the node hierarchy
            for (var i=0; i<nodes.length; ++i) {
                if (nodeDrivers[i] > 0) {
                    this._applyActiveNodeToTree(i);
                }
            }
        }

        // set the active pose t, r, s for the specified link into the active pose
        , _setActive: function (link) {
            var activePose = this._activePose;
            var idx = link.node * 10;
            var t = link.translation;
            var r = link.rotation;
            var s = link.scale;
            if (t) { for (var i=0; i<3; ++i) { activePose[idx+i] = t[i]; } }
            if (r) { for (var i=0; i<4; ++i) { activePose[idx+3+i] = r[i]; } }
            if (s) { for (var i=0; i<3; ++i) { activePose[idx+7+i] = s[i]; } }
        }

        // blend the t, r, s for the specified link into the active pose
        , _blendActive: function (link, weight, oneMinusWeight) {
            var activePose = this._activePose;
            var idx = link.node * 10;
            var t = link.translation;
            var r = link.rotation;
            var s = link.scale;
            if (t) {
                for (var i=0; i<3; ++i) {
                    activePose[idx+i] = activePose[idx+i] * oneMinusWeight + t[i] * weight;
                }
            }
            if (r) {
                for (var i=0; i<4; ++i) {
                    activePose[idx+3+i] = activePose[idx+3+i] * oneMinusWeight + r[i] * weight;
                }
            }
            if (s) {
                for (var i=0; i<3; ++i) {
                    activePose[idx+7+i] = activePose[idx+7+i] * oneMinusWeight + s[i] * weight;
                }
            }
        },

        _applyActiveNodeToTree: function (nodeIndex) {
            var activePose = this._activePose;
            var node = this._nodes[nodeIndex];
            var p = node.localPosition;
            var r = node.localRotation;
            var s = node.localScale;

            var idx = nodeIndex * 10;
            p.x = activePose[idx++];
            p.y = activePose[idx++];
            p.z = activePose[idx++];
            r.x = activePose[idx++];
            r.y = activePose[idx++];
            r.z = activePose[idx++];
            r.w = activePose[idx++];
            s.x = activePose[idx++];
            s.y = activePose[idx++];
            s.z = activePose[idx++];

            // TODO: decide at what point to renormalize quaternions, options are:
            // after curve evaluation
            // after link blending
            // right at the end
            // all of the above

            // TODO: this is not an optimal way of dirtifying the hierarchy
            node._dirtifyLocal();
        }
    });

    return {
        AnimInterpolation: AnimInterpolation,
        AnimData: AnimData,
        AnimCurve: AnimCurve,
        AnimTarget: AnimTarget,
        AnimTrack: AnimTrack,
        AnimSnapshot: AnimSnapshot,
        AnimClip: AnimClip,
        AnimController: AnimController,
    };
}());
