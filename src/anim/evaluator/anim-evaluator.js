import { Quat } from '../../math/quat.js';
import { Vec3 } from '../../math/vec3.js';
import { ANIM_LAYER_OVERWRITE } from '../controller/constants.js';

class AnimTarget {
    constructor(component, type) {
        this._component = component;
        this._mask = new Int8Array(component.layers.length);
        this._weights = new Float32Array(component.layers.length);
        this._totalWeight = 0;
        this._counter = 0;
        this._layerCounter = 0;
        this._valueType = type;

        if (this._valueType === AnimTarget.TYPE_QUAT) {
            this._value = new Quat();
            this._currentValue = new Quat();
        } else {
            this._value = new Vec3();
            this._currentValue = new Vec3();
        }
    }

    get valueType() {
        return this._valueType;
    }

    get mask() {
        return this._mask;
    }

    set mask(value) {
        this._mask = value;
    }

    get weights() {
        return this._weights;
    }

    get totalWeight() {
        return this._totalWeight;
    }

    set totalWeight(value) {
        this._totalWeight = value;
    }

    get counter() {
        return this._counter;
    }

    set counter(value) {
        this._counter = value;
    }

    get layerCounter() {
        return this._layerCounter;
    }

    set layerCounter(value) {
        this._layerCounter = value;
    }

    get value() {
        return this._value;
    }

    set value(value) {
        this._value = value;
    }

    weight(index) {
        if (this._component.dirtyWeights) this.updateWeights();
        if (this.totalWeight === 0) return 0;
        return this.weights[index] / this.totalWeight;
    }

    setMask(index, value) {
        this._mask[index] = value;
        if (this._component.layers[index].blendType === ANIM_LAYER_OVERWRITE) {
            this._mask = this._mask.fill(0, 0, index - 1);
        }
        this.updateWeights();
    }

    updateWeights() {
        this._totalWeight = 0;
        for (let i = 0; i < this._weights.length; i++) {
            this._weights[i] = this._component.layers[i].weight;
            this._totalWeight += this._mask[i] * this._weights[i];
        }
    }

    updateValue(index, value) {
        if (this._counter === 0) {
            this._value.set(0, 0, 0, 1);
        }
        this._currentValue.set(...value);
        switch (this._valueType) {
            case (AnimTarget.TYPE_QUAT): {
                this._value.mul(this._currentValue.slerp(Quat.IDENTITY, this._currentValue, this.weight(index)));
                break;
            }
            case (AnimTarget.TYPE_VEC3): {
                this._value.add(this._currentValue.mulScalar(this.weight(index)));
                break;
            }
        }
    }

    get valueData() {
        switch (this._valueType) {
            case (AnimTarget.TYPE_QUAT): {
                return [this._value.x, this._value.y, this._value.z, this._value.w];
            }
            case (AnimTarget.TYPE_VEC3): {
                return this._value.data;
            }
            default:
                return null;
        }
    }
}

AnimTarget.TYPE_QUAT = 'QUATERNION';
AnimTarget.TYPE_VEC3 = 'VECTOR3';

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
                    if (this._binder.animComponent) {
                        if (!this._binder.animComponent.targets[resolved.targetPath]) {
                            let type;
                            if (resolved.targetPath.indexOf('localRotation') === -1) {
                                type = AnimTarget.TYPE_VEC3;
                            } else {
                                type = AnimTarget.TYPE_QUAT;
                            }
                            this._binder.animComponent.targets[resolved.targetPath] = new AnimTarget(this._binder.animComponent, type);
                        }
                        this._binder.animComponent.targets[resolved.targetPath].layerCounter++;
                        this._binder.animComponent.targets[resolved.targetPath].setMask(this._binder.index, 1);
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
                        if (this._binder.animComponent) {
                            this._binder.animComponent.targets[target.targetPath].layerCounter--;
                        }
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
                if (this._binder.animComponent) {
                    const animTarget = this._binder.animComponent.targets[path];
                    if (animTarget.counter === animTarget.layerCounter) {
                        animTarget.counter = 0;
                    }
                    if (animTarget.mask[this._binder.index]) {
                        animTarget.updateValue(this._binder.index, target.value);
                    }
                    target.target.func(animTarget.valueData);
                    animTarget.counter++;
                } else {
                    target.target.func(target.value);
                }
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
