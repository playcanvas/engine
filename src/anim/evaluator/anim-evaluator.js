/**
 * @private
 * @class
 * @name AnimEvaluator
 * @classdesc AnimEvaluator blends multiple sets of animation clips together.
 * @description Create a new animation evaluator.
 * @param {AnimBinder} binder - interface resolves curve paths to instances of {@link AnimTarget}.
 * @property {AnimClip[]} clips - the list of animation clips
 */
class AnimEvaluator {
    constructor(binder) {
        this._binder = binder;
        this._clips = [];
        this._inputs = [];
        this._outputs = [];
        this._targets = {};
    }

    static _dot(a, b) {
        var len  = a.length;
        var result = 0;
        for (var i = 0; i < len; ++i) {
            result += a[i] * b[i];
        }
        return result;
    }

    static _normalize(a) {
        var l = AnimEvaluator._dot(a, a);
        if (l > 0) {
            l = 1.0 / Math.sqrt(l);
            var len = a.length;
            for (var i = 0; i < len; ++i) {
                a[i] *= l;
            }
        }
    }

    static _set(a, b, type) {
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
    }

    static _blendVec(a, b, t) {
        var it = 1.0 - t;
        var len = a.length;
        for (var i = 0; i < len; ++i) {
            a[i] = a[i] * it + b[i] * t;
        }
    }

    static _blendQuat(a, b, t) {
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
    }

    static _blend(a, b, t, type) {
        if (type === 'quaternion') {
            AnimEvaluator._blendQuat(a, b, t);
        } else {
            AnimEvaluator._blendVec(a, b, t);
        }
    }

    static _stableSort(a, lessFunc) {
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
    }

    /**
     * @private
     * @name AnimEvaluator#clips
     * @type {AnimClip[]}
     * @description The number of clips.
     */
    get clips() {
        return this._clips;
    }

    /**
     * @private
     * @function
     * @name AnimEvaluator#addClip
     * @description Add a clip to the evaluator.
     * @param {AnimClip} clip - The clip to add to the evaluator.
     */
    addClip(clip) {
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
                var resolved = this._binder.resolve(path);
                var target = targets[resolved && resolved.targetPath || null];

                // create new target if it doesn't exist yet
                if (!target && resolved) {
                    target = {
                        target: resolved,           // resolved target instance
                        value: [],                  // storage for calculated value
                        curves: 0,                  // number of curves driving this target
                        blendCounter: 0             // per-frame number of blends (used to identify first blend)
                    };

                    for (var k = 0; k < target.target.components; ++k) {
                        target.value.push(0);
                    }

                    targets[resolved.targetPath] = target;
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
    }

    /**
     * @private
     * @function
     * @name AnimEvaluator#removeClip
     * @description Remove a clip from the evaluator.
     * @param {number} index - Index of the clip to remove.
     */
    removeClip(index) {
        var targets = this._targets;

        var clips = this._clips;
        var clip = clips[index];
        var curves = clip.track.curves;

        for (var i = 0; i < curves.length; ++i) {
            var curve = curves[i];
            var paths = curve.paths;
            for (var j = 0; j < paths.length; ++j) {
                var path = paths[j];

                var target = this._binder.resolve(path);

                if (target) {
                    target.curves--;
                    if (target.curves === 0) {
                        this._binder.unresolve(path);
                        delete targets[target.targetPath];
                    }
                }
            }
        }

        clips.splice(index, 1);
        this._inputs.splice(index, 1);
        this._outputs.splice(index, 1);
    }

    /**
     * @private
     * @function
     * @name AnimEvaluator#removeClips
     * @description Remove all clips from the evaluator.
     */
    removeClips() {
        while (this._clips.length > 0) {
            this.removeClip(0);
        }
    }

    /**
     * @private
     * @function
     * @name AnimEvaluator#findClip
     * @description Returns the first clip which matches the given name, or null if no such clip was found.
     * @param {string} name - Name of the clip to find.
     * @returns {AnimClip|null} - The clip with the given name or null if no such clip was found.
     */
    findClip(name) {
        var clips = this._clips;
        for (var i = 0; i < clips.length; ++i) {
            var clip = clips[i];
            if (clip.name === name) {
                return clip;
            }
        }
        return null;
    }

    rebind() {
        this._binder.rebind();
        this._targets = {};
        var clips = [...this.clips];
        this.removeClips();
        clips.forEach((clip) => {
            this.addClip(clip);
        });
    }

    /**
     * @private
     * @function
     * @name AnimEvaluator#update
     * @description Evaluator frame update function. All the attached {@link AnimClip}s are evaluated,
     * blended and the results set on the {@link AnimTarget}.
     * @param {number} deltaTime - The amount of time that has passed since the last update, in seconds.
     */
    update(deltaTime) {
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

        for (i = 0; i < order.length; ++i) {
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
}

export { AnimEvaluator };
