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

        // these members are calculated per-time
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

    /*
    Object.assign(AnimTarget.prototype, {
        get name() { return this._name },
        get translation() { return this._translation },
        get rotation() { return this._rotation },
        get scale() { return this._scale }
    });
    */

    Object.defineProperty(AnimTarget.prototype, 'name', {
        get: function () { return this._name; }
    });

    Object.defineProperty(AnimTarget.prototype, 'translation', {
        get: function () { return this._translation; }
    });

    Object.defineProperty(AnimTarget.prototype, 'rotation', {
        get: function () { return this._rotation; }
    });

    Object.defineProperty(AnimTarget.prototype, 'scale', {
        get: function () { return this._scale; }
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

    Object.defineProperty(AnimTrack.prototype, 'name', {
        get: function () { return this._name; }
    });

    Object.defineProperty(AnimTrack.prototype, 'duration', {
        get: function () { return this._duration; }
    });

    Object.defineProperty(AnimTrack.prototype, 'targets', {
        get: function () { return this._targets; }
    });

    Object.assign(AnimTrack.prototype, {
        //get name() { return this._name },
        //get duration() { return this._duration },
        //get targets() { return this._targets },

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
        this._time = time;
        this._speed = speed;
        this._loop = loop;
    };

    Object.defineProperty(AnimClip.prototype, 'name', {
        get: function () { return this._track._name; }
    });

    Object.defineProperty(AnimClip.prototype, 'track', {
        get: function () { return this._track; }
    });

    Object.defineProperty(AnimClip.prototype, 'snapshot', {
        get: function () { return this._snapshot; }
    });

    Object.defineProperty(AnimClip.prototype, 'time', {
        get: function () { return this._time; },
        set: function (time) { this._time = time; }
    });

    Object.defineProperty(AnimClip.prototype, 'speed', {
        get: function () { return this._speed; },
        set: function (speed) { this._speed = speed; }
    });

    Object.defineProperty(AnimClip.prototype, 'loop', {
        get: function () { return this._loop; },
        set: function (loop) { this._loop = loop; }
    });

    Object.assign(AnimClip.prototype, {
        /*
        get name() { return this._track.name },
        get track() { return this._track },
        get snapshot() { return this._snapshot },
        get time() { return this._time },
        get speed() { return this._speed },
        get loop() { return this._loop },

        set time(time) { this._time = time; },
        set speed(speed) { this._speed = speed; },
        set loop(loop) { this._loop = loop; },
        */

        _update: function (deltaTime) {
            if (!this._playing) {
                return;
            }

            // update time
            var time = this._time + this._speed * deltaTime;
            var duration = this._track.duration;
            var speed = this._speed;
            var loop = this._loop;

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

            // if time has changed, update snapshot
            if (time != this._time) {
                this._track.eval(time, this._snapshot);
                this._time = time;
            }
        },

        play: function () {
            this._playing = true;
        },

        pause: function () {
            this._playing = false;
        },

        reset: function () {
            this._time = 0;
        },

        restart: function () {
            this.reset();
            this.play();
        }
    });

    // animation controller
    // 
    // stores a set of clips and blends between them
    var AnimController = function (graph) {

        // build flat list of nodes
        var nodes = { };
        var flatten = function (node) {
            nodes[node.name] = node;
            for (var i=0; i<node.children.length; ++i) {
                flatten(node.children[i]);
            }
        };
        flatten(graph);

        this._nodes = nodes;
        this._clips = [ ];
    };

    Object.assign(AnimController.prototype, {
        addClip: function (clip) {
            var targets = clip.track.targets;
            var snapshot = clip.snapshot;

            // create links between the target node and animation curve results for t, r, s
            var links = [ ];
            for (var i=0; i<targets.length; ++i) {
                var target = targets[i];
                var name = target.name;
                if (this._nodes.hasOwnProperty(name)) {
                    var link = {
                        node: this._nodes[name],
                        translation: target.translation !== -1 ? snapshot._results[target.translation] : null,
                        rotation: target.rotation !== -1 ? snapshot._results[target.rotation] : null,
                        scale: target.scale !== -1 ? snapshot._results[target.scale] : null
                    };
                    if (link.translation || link.rotation || link.scale) {
                        links.push(link);
                    }
                }
            }

            this._clips.push({
                clip: clip,
                links: links,
                weight: 1.0
            });
        },

        numClips: function () {
            return this._clips.length;
        },

        removeClip: function (index) {
            this._clips.splice(index, 1);
        },

        getClip: function (index) {
            return this._clips[index].clip;
        },

        findClip: function (name) {
            for (var i=0; i<this._clips.length; ++i) {
                if (this._clips[i].name === name) {
                    return i;
                }
            }
            return -1;
        },

        update: function (deltaTime) {
            var clips = this._clips;

            // apply clips to nodes
            for (var c=0; c<clips.length; ++c) {
                var clip = clips[c];

                clip.clip._update(deltaTime);

                for (var i=0; i<clip.links.length; ++i) {
                    var link = clip.links[i];
                    var node = link.node;
                    // TODO: these should blend, rotation should renormalize
                    if (link.translation) {
                        this._copyVec3(node.localPosition, link.translation);
                    }
                    if (link.rotation) {
                        this._copyQuat(node.localRotation, link.rotation);
                    }
                    if (link.scale) {
                        this._copyVec3(node.localScale, link.scale);
                    }
                    node._dirtifyLocal();
                }
            }
        },

        _copyVec3: function (dst, src) {
            dst.x = src[0];
            dst.y = src[1];
            dst.z = src[2];
        },

        _copyQuat: function (dst, src) {
            dst.x = src[0];
            dst.y = src[1];
            dst.z = src[2];
            dst.w = src[3];
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
