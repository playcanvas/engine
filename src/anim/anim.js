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
     * @class
     * @name pc.AnimData
     * @classdesc Wraps a set of data used in animation.
     * @description Create a new animation data container.
     * @param {number} components - Specifies how many components make up an element of data.
     * For example, specify 3 for a set of 3-dimensional vectors. The number of elements in
     * data array must be a multiple of components.
     * @param {Float32Array|number[]} data - The set of data
     * @property {number} components - The number of components that make up and element
     * @property {Float32Array|number[]} data - The data
     */
    var AnimData = function (components, data) {
        this._components = components;
        this._data = data;
    };

    Object.defineProperties(AnimData.prototype, {
        components: {
            get: function () {
                return this._components;
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
            var comp = output._components;
            var idx0 = this._p0 * comp;
            var i;

            if (interpolation === pc.INTERPOLATION_STEP) {
                for (i = 0; i < comp; ++i) {
                    result[i] = data[idx0 + i];
                }
            } else {
                var t = this._t;
                var idx1 = this._p1 * comp;

                switch (interpolation) {
                    case pc.INTERPOLATION_LINEAR:
                        for (i = 0; i < comp; ++i) {
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

                        var p0 = (this._p0 * 3 + 1) * comp;     // point at k
                        var m0 = (this._p0 * 3 + 2) * comp;     // out-tangent at k
                        var p1 = (this._p1 * 3 + 1) * comp;     // point at k + 1
                        var m1 = (this._p1 * 3 + 0) * comp;     // in-tangent at k + 1

                        for (i = 0; i < comp; ++i) {
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
     * @class
     * @name pc.AnimCurve
     * @classdesc Animation curve links an input data set to an output data set
     * and defines the interpolation method to use.
     * @description Create a new animation curve
     * @param {string[]} paths - array of path strings identifying the targets of this curve, for example "rootNode.translation".
     * @param {number} input - index of the curve which specifies the key data.
     * @param {number} output - index of the curve which specifies the value data.
     * @param {number} interpolation - the interpolation method to use. One of the following:
     *
     * * {@link pc.INTERPOLATION_STEP}
     * * {@link pc.INTERPOLATION_LINEAR}
     * * {@link pc.INTERPOLATION_CUBIC}
     */
    var AnimCurve = function (paths, input, output, interpolation) {
        this._paths = paths;
        this._input = input;
        this._output = output;
        this._interpolation = interpolation;
    };

    Object.defineProperties(AnimCurve.prototype, {
        paths: {
            get: function () {
                return this._paths;
            }
        },
        input: {
            get: function () {
                return this._input;
            }
        },
        output: {
            get: function () {
                return this._output;
            }
        },
        interpolation: {
            get: function () {
                return this._interpolation;
            }
        }
    });

    /**
     * @class
     * @name pc.AnimTrack
     * @classdesc AnimTrack contains a set of curve data which can be used to animate a set of target nodes.
     * @description Create a new animation track.
     * @param {string} name - the track name
     * @param {number} duration - the duration of the track in seconds.
     * @param {pc.AnimData[]} inputs - list of curve key data.
     * @param {pc.AnimData[]} outputs - list of curve value data.
     * @param {pc.AnimCurve[]} curves - the list of curves.
     * @property {string} name - the track name
     */
    var AnimTrack = function (name, duration, inputs, outputs, curves) {
        this._name = name;
        this._duration = duration;
        this._inputs = inputs;
        this._outputs = outputs;
        this._curves = curves;
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
        inputs: {
            get: function () {
                return this._inputs;
            }
        },
        outputs: {
            get: function () {
                return this._outputs;
            }
        },
        curves: {
            get: function () {
                return this._curves;
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
            for (var j = 0; j < output._components; ++j) {
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
        this._speed = speed;            // playback speed, may be negative
        this._loop = loop;              // whether to loop
        this._blendWeight = 1.0;        // blend weight 0..1
        this._blendOrder = 0.0;         // blend order relative to other clips
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
        },
        blendOrder: {
            get: function () {
                return this._blendOrder;
            },
            set: function (blendOrder) {
                this._blendOrder = blendOrder;
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
     * @callback pc.AnimSetter
     * @description Callback function that the {@link pc.AnimEvaluator} uses to set final animation values.
     * These callbacks are stored in {@link pc.AnimTarget} instances which are constructed by an
     * {@link pc.AnimBinder}.
     * @param {number[]} value - updated animation value.
     */

    /**
     * @private
     * @class
     * @name pc.AnimTarget
     * @classdesc Stores the information required by {@link pc.AnimEvaluator} for updating a target value.
     * @param {pc.AnimSetter} func - this function will be called when a new animation value is output by
     * the {@link pc.AnimEvaluator}.
     * @param {'vector'|'quaternion'} type - the type of animation data this target expects.
     * @param {number} components - the number of components on this target (this should ideally match the number
     * of components found on all attached animation curves).
     */
    var AnimTarget = function (func, type, components) {
        this._func = func;
        this._type = type;
        this._components = components;
    };

    Object.defineProperties(AnimTarget.prototype, {
        func: {
            get: function () {
                return this._func;
            }
        },
        type: {
            get: function () {
                return this._type;
            }
        },
        components: {
            get: function () {
                return this._components;
            }
        }
    });

    /**
     * @private
     * @class
     * @name pc.AnimBinder
     * @classdesc This interface is used by {@link pc.AnimEvaluator} to resolve unique animation target path strings
     * into instances of {@link pc.AnimTarget}.
     */
    var AnimBinder = function () { };

    // join a list of path segments into a path string using the full stop character. If another character is supplied,
    // it will join using that character instead
    AnimBinder.joinPath = function (pathSegments, character) {
        character = character || '.';
        var escape = function (string) {
            return string.replace(/\\/g, '\\\\').replace(new RegExp('\\' + character, 'g'), '\\' + character);
        };
        return pathSegments.map(escape).join(character);
    };

    // split a path string into its segments and resolve character escaping
    AnimBinder.splitPath = function (path, character) {
        character = character || '.';
        var result = [];
        var curr = "";
        var i = 0;
        while (i < path.length) {
            var c = path[i++];

            if (c === '\\' && i < path.length) {
                c = path[i++];
                if (c === '\\' || c === character) {
                    curr += c;
                } else {
                    curr += '\\' + c;
                }
            } else if (c === character) {
                result.push(curr);
                curr = '';
            } else {
                curr += c;
            }
        }
        if (curr.length > 0) {
            result.push(curr);
        }
        return result;
    };

    Object.assign(AnimBinder.prototype, {
        /**
         * @private
         * @function
         * @name pc.AnimBinder#resolve
         * @description Resolve the provided target path and return an instance of {@link pc.AnimTarget} which
         * will handle setting the value, or return null if no such target exists.
         * @param {string} path - the animation curve path to resolve.
         * @returns {pc.AnimTarget|null} - returns the target instance on success and null otherwise.
         */
        resolve: function (path) {
            return null;
        },

        /**
         * @private
         * @function
         * @name pc.AnimBinder#unresolve
         * @description Called when the {@link AnimEvaluator} no longer has a curve driving the given key.
         * @param {string} path - the animation curve path which is no longer driven.
         */
        unresolve: function (path) {

        },

        /**
         * @private
         * @function
         * @name pc.AnimBinder#update
         * @description Called by {@link pc.AnimEvaluator} once a frame after animation updates are done.
         * @param {number} deltaTime - amount of time that passed in the current update.
         */
        update: function (deltaTime) {

        }
    });

    /**
     * @private
     * @class
     * @name pc.DefaultAnimBinder
     * @implements {pc.AnimBinder}
     * @classdesc Implementation of {@link pc.AnimBinder} for animating a skeleton in the graph-node
     * hierarchy.
     */
    var DefaultAnimBinder = function (graph) {
        var nodes = { };

        // cache node names so we can quickly resolve animation paths
        var flatten = function (node) {
            nodes[node.name] = {
                node: node,
                count: 0
            };
            for (var i = 0; i < node.children.length; ++i) {
                flatten(node.children[i]);
            }
        };
        flatten(graph);

        this.nodes = nodes;                 // map of node name -> { node, count }
        this.activeNodes = [];              // list of active nodes
        this.handlers = {
            'localPosition': function (node) {
                var object = node.localPosition;
                var func = function (value) {
                    object.set.apply(object, value);
                };
                return new pc.AnimTarget(func, 'vector', 3);
            },

            'localRotation': function (node) {
                var object = node.localRotation;
                var func = function (value) {
                    object.set.apply(object, value);
                };
                return new pc.AnimTarget(func, 'quaternion', 4);
            },

            'localScale': function (node) {
                var object = node.localScale;
                var func = function (value) {
                    object.set.apply(object, value);
                };
                return new pc.AnimTarget(func, 'vector', 3);
            },

            'weights': function (node) {
                var object = node;
                while (object && object.constructor !== pc.Entity) {
                    object = object.parent;
                }
                if (!object ||
                    !object.model ||
                    !object.model.model ||
                    !object.model.model.morphInstances) {
                    return null;
                }
                var meshInstances = object.model.meshInstances;
                var morphInstance;
                for (var i = 0; i < meshInstances.length; ++i) {
                    if (meshInstances[i].node.name === node.name) {
                        morphInstance = meshInstances[i].morphInstance;
                        break;
                    }
                }
                if (!morphInstance) {
                    return null;
                }
                var func = function (value) {
                    for (var i = 0; i < value.length; ++i) {
                        morphInstance.setWeight(i, value[i]);
                    }
                };
                return new pc.AnimTarget(func, 'vector', morphInstance.morph._targets.length);
            }
        };

        this.propertyLocator = new pc.AnimPropertyLocator();
    };

    Object.assign(DefaultAnimBinder.prototype, {
        resolve: function (path) {
            var pathSections = this.propertyLocator.decode(path);

            var node = this.nodes[pathSections[0][0]];
            if (!node) {
                return null;
            }

            var handler = this.handlers[pathSections[2][0]];
            if (!handler) {
                return null;
            }

            var target = handler(node.node);
            if (!target) {
                return null;
            }

            if (node.count === 0) {
                this.activeNodes.push(node.node);
            }
            node.count++;

            return target;
        },

        unresolve: function (path) {
            var pathSections = this.propertyLocator.decode(path);
            if (pathSections[1] !== 'graph')
                return;

            var node = this.nodes[pathSections[0][0]];

            node.count--;
            if (node.count === 0) {
                var activeNodes = this.activeNodes;
                var i = activeNodes.indexOf(node.node);  // :(
                var len = activeNodes.length;
                if (i < len - 1) {
                    activeNodes[i] = activeNodes[len - 1];
                }
                activeNodes.pop();
            }
        },

        // flag animating nodes as dirty
        update: function (deltaTime) {
            var activeNodes = this.activeNodes;
            for (var i = 0; i < activeNodes.length; ++i) {
                activeNodes[i]._dirtifyLocal();
            }
        },

        // get the path parts. we expect parts to have structure nodeName.[translation|rotation|scale|weights]
        _getParts: function (path) {
            var parts = AnimBinder.splitPath(path);
            if (parts.length !== 2 ||
                !this.nodes.hasOwnProperty(parts[0]) ||
                !this.handlers.hasOwnProperty(parts[1])) {
                return null;
            }
            return parts;
        }
    });

    /**
     * @private
     * @class
     * @name pc.AnimEvaluator
     * @classdesc AnimEvaluator blends multiple sets of animation clips together.
     * @description Create a new animation evaluator.
     * @param {pc.AnimBinder} binder - interface resolves curve paths to instances of {@link pc.AnimTarget}.
     * @property {pc.AnimClip[]} clips - the list of animation clips
     */
    var AnimEvaluator = function (binder) {
        this._binder = binder;
        this._clips = [];
        this._inputs = [];
        this._outputs = [];
        this._targets = {};
    };

    /**
     * @private
     * @name pc.AnimEvaluator
     * @type {number}
     * @description The number of clips.
     */
    Object.defineProperties(AnimEvaluator.prototype, {
        'clips': {
            get: function () {
                return this._clips;
            }
        }
    });

    AnimEvaluator._dot = function (a, b) {
        var len  = a.length;
        var result = 0;
        for (var i = 0; i < len; ++i) {
            result += a[i] * b[i];
        }
        return result;
    };

    AnimEvaluator._normalize = function (a) {
        var l = AnimEvaluator._dot(a, a);
        if (l > 0) {
            l = 1.0 / Math.sqrt(l);
            var len = a.length;
            for (var i = 0; i < len; ++i) {
                a[i] *= l;
            }
        }
    };

    AnimEvaluator._set = function (a, b, type) {
        var len  = a.length;
        var i;

        if (type === 'quaternion') {
            var l = AnimEvaluator._dot(b, b);
            if (l > 0) {
                l = 1.0 / Math.sqrt(l);
            }
            for (i = 0; i < len; ++i) {
                a[i] = b[i] * l;
            }
        } else {
            for (i = 0; i < len; ++i) {
                a[i] = b[i];
            }
        }
    };

    AnimEvaluator._blendVec = function (a, b, t) {
        var it = 1.0 - t;
        var len = a.length;
        for (var i = 0; i < len; ++i) {
            a[i] = a[i] * it + b[i] * t;
        }
    };

    AnimEvaluator._blendQuat = function (a, b, t) {
        var len = a.length;
        var it = 1.0 - t;

        // negate b if a and b don't lie in the same winding (due to
        // double cover). if we don't do this then often rotations from
        // one orientation to another go the long way around.
        if (AnimEvaluator._dot(a, b) < 0) {
            t = -t;
        }

        for (var i = 0; i < len; ++i) {
            a[i] = a[i] * it + b[i] * t;
        }

        AnimEvaluator._normalize(a);
    };

    AnimEvaluator._blend = function (a, b, t, type) {
        if (type === 'quaternion') {
            AnimEvaluator._blendQuat(a, b, t);
        } else {
            AnimEvaluator._blendVec(a, b, t);
        }
    };

    AnimEvaluator._stableSort = function (a, lessFunc) {
        var len = a.length;
        for (var i = 0; i < len - 1; ++i) {
            for (var j = i + 1; j < len; ++j) {
                if (lessFunc(a[j], a[i])) {
                    var tmp = a[i];
                    a[i] = a[j];
                    a[j] = tmp;
                }
            }
        }
    };

    Object.assign(AnimEvaluator.prototype, {
        /**
         * @private
         * @function
         * @name pc.AnimEvaluator#addClip
         * @description Add a clip to the evaluator.
         * @param {pc.AnimClip} clip - the clip to add to the evaluator.
         */
        addClip: function (clip) {
            var targets = this._targets;

            // store list of input/output arrays
            var curves = clip.track.curves;
            var snapshot = clip.snapshot;
            var inputs = [];
            var outputs = [];
            for (var i = 0; i < curves.length; ++i) {
                var curve = curves[i];
                var paths = curve.paths;
                for (var j = 0; j < paths.length; ++j) {
                    var path = paths[j];
                    var target = targets[path];

                    // create new target if it doesn't exist yet
                    if (!target) {
                        var resolved = this._binder.resolve(path);
                        if (resolved) {
                            target = {
                                target: resolved,           // resolved target instance
                                value: [],                  // storage for calculated value
                                curves: 0,                  // number of curves driving this target
                                blendCounter: 0             // per-frame number of blends (used to identify first blend)
                            };

                            for (var k = 0; k < target.target.components; ++k) {
                                target.value.push(0);
                            }

                            targets[path] = target;
                        }
                    }

                    // binding may have failed
                    // TODO: it may be worth storing quaternions and vector targets in seperate
                    // lists. this way the update code won't be foreced to check target type before
                    // setting/blending each target.
                    if (target) {
                        target.curves++;
                        inputs.push(snapshot._results[i]);
                        outputs.push(target);
                    }
                }
            }

            this._clips.push(clip);
            this._inputs.push(inputs);
            this._outputs.push(outputs);
        },

        /**
         * @private
         * @function
         * @name pc.AnimEvaluator#removeClip
         * @description Remove a clip from the evaluator.
         * @param {number} index - index of the clip to remove.
         */
        removeClip: function (index) {
            var targets = this._targets;

            var clips = this._clips;
            var clip = clips[index];
            var curves = clip.track.curves;

            for (var i = 0; i < curves.length; ++i) {
                var curve = curves[i];
                var paths = curve.paths;
                for (var j = 0; j < paths.length; ++j) {
                    var path = paths[j];

                    var target = targets[path];

                    if (target) {
                        target.curves--;
                        if (target.curves === 0) {
                            this._binder.unresolve(path);
                            delete targets[path];
                        }
                    }
                }
            }

            clips.splice(index, 1);
            this._inputs.splice(index, 1);
            this._outputs.splice(index, 1);
        },

        /**
         * @private
         * @function
         * @name pc.AnimEvaluator#removeClips
         * @description Remove all clips from the evaluator.
         */
        removeClips: function () {
            while (this._clips.length > 0) {
                this.removeClip(0);
            }
        },

        /**
         * @private
         * @function
         * @name pc.AnimEvaluator#findClip
         * @description Returns the first clip which matches the given name, or null if no such clip was found.
         * @param {string} name - name of the clip to find.
         * @returns {pc.AnimClip|null} - the clip with the given name or null if no such clip was found.
         */
        findClip: function (name) {
            var clips = this._clips;
            for (var i = 0; i < clips.length; ++i) {
                var clip = clips[i];
                if (clip.name === name) {
                    return clip;
                }
            }
            return null;
        },

        /**
         * @private
         * @function
         * @name pc.AnimEvaluator#update
         * @description Evaluator frame update function. All the attached {@link pc.AnimClip}s are evaluated,
         * blended and the results set on the {@link pc.AnimTarget}.
         * @param {number} deltaTime - the amount of time that has passed since the last update, in seconds.
         */
        update: function (deltaTime) {
            // copy clips
            var clips = this._clips;

            // stable sort order
            var order = clips.map(function (c, i) {
                return i;
            });
            AnimEvaluator._stableSort(order, function (a, b) {
                return clips[a].blendOrder < clips[b].blendOrder;
            });

            var i, j;

            for (i = 0; i < clips.length; ++i) {
                var index = order[i];
                var clip = clips[index];
                var inputs = this._inputs[index];
                var outputs = this._outputs[index];
                var blendWeight = clip.blendWeight;

                // update clip
                if (blendWeight > 0.0) {
                    clip._update(deltaTime);
                }

                var input;
                var output;
                var value;

                if (blendWeight >= 1.0) {
                    for (j = 0; j < inputs.length; ++j) {
                        input = inputs[j];
                        output = outputs[j];
                        value = output.value;

                        AnimEvaluator._set(value, input, output.target.type);

                        output.blendCounter++;
                    }
                } else if (blendWeight > 0.0) {
                    for (j = 0; j < inputs.length; ++j) {
                        input = inputs[j];
                        output = outputs[j];
                        value = output.value;

                        if (output.blendCounter === 0) {
                            AnimEvaluator._set(value, input, output.target.type);
                        } else {
                            AnimEvaluator._blend(value, input, blendWeight, output.target.type);
                        }

                        output.blendCounter++;
                    }
                }
            }

            // apply result to anim targets
            var targets = this._targets;
            for (var path in targets) {
                if (targets.hasOwnProperty(path)) {
                    var target = targets[path];
                    target.target.func(target.value);
                    target.blendCounter = 0;
                }
            }

            // give the binder an opportunity to update itself
            // TODO: is this even necessary? binder could know when to update
            // itself without our help.
            this._binder.update(deltaTime);
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
        AnimBinder: AnimBinder,
        DefaultAnimBinder: DefaultAnimBinder,
        AnimEvaluator: AnimEvaluator
    };
}());
