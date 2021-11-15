import { AnimTargetValue } from './anim-target-value.js';

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
        const len  = a.length;
        let result = 0;
        for (let i = 0; i < len; ++i) {
            result += a[i] * b[i];
        }
        return result;
    }

    static _normalize(a) {
        let l = AnimEvaluator._dot(a, a);
        if (l > 0) {
            l = 1.0 / Math.sqrt(l);
            const len = a.length;
            for (let i = 0; i < len; ++i) {
                a[i] *= l;
            }
        }
    }

    static _set(a, b, type) {
        const len  = a.length;

        if (type === 'quaternion') {
            let l = AnimEvaluator._dot(b, b);
            if (l > 0) {
                l = 1.0 / Math.sqrt(l);
            }
            for (let i = 0; i < len; ++i) {
                a[i] = b[i] * l;
            }
        } else {
            for (let i = 0; i < len; ++i) {
                a[i] = b[i];
            }
        }
    }

    static _blendVec(a, b, t) {
        const it = 1.0 - t;
        const len = a.length;
        for (let i = 0; i < len; ++i) {
            a[i] = a[i] * it + b[i] * t;
        }
    }

    static _blendQuat(a, b, t) {
        const len = a.length;
        const it = 1.0 - t;

        // negate b if a and b don't lie in the same winding (due to
        // double cover). if we don't do this then often rotations from
        // one orientation to another go the long way around.
        if (AnimEvaluator._dot(a, b) < 0) {
            t = -t;
        }

        for (let i = 0; i < len; ++i) {
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
        const len = a.length;
        for (let i = 0; i < len - 1; ++i) {
            for (let j = i + 1; j < len; ++j) {
                if (lessFunc(a[j], a[i])) {
                    const tmp = a[i];
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
        const targets = this._targets;
        const binder = this._binder;

        // store list of input/output arrays
        const curves = clip.track.curves;
        const snapshot = clip.snapshot;
        const inputs = [];
        const outputs = [];
        for (let i = 0; i < curves.length; ++i) {
            const curve = curves[i];
            const paths = curve.paths;
            for (let j = 0; j < paths.length; ++j) {
                const path = paths[j];
                const resolved = binder.resolve(path);
                let target = targets[resolved && resolved.targetPath || null];

                // create new target if it doesn't exist yet
                if (!target && resolved) {
                    target = {
                        target: resolved,           // resolved target instance
                        value: [],                  // storage for calculated value
                        curves: 0,                  // number of curves driving this target
                        blendCounter: 0             // per-frame number of blends (used to identify first blend)
                    };

                    for (let k = 0; k < target.target.components; ++k) {
                        target.value.push(0);
                    }

                    targets[resolved.targetPath] = target;
                    if (binder.animComponent) {
                        if (!binder.animComponent.targets[resolved.targetPath]) {
                            let type;
                            if (resolved.targetPath.substring(resolved.targetPath.length - 13) === 'localRotation') {
                                type = AnimTargetValue.TYPE_QUAT;
                            } else {
                                type = AnimTargetValue.TYPE_VEC3;
                            }
                            binder.animComponent.targets[resolved.targetPath] = new AnimTargetValue(binder.animComponent, type);
                        }
                        binder.animComponent.targets[resolved.targetPath].layerCounter++;
                        binder.animComponent.targets[resolved.targetPath].setMask(binder.layerIndex, 1);
                    }
                }

                // binding may have failed
                // TODO: it may be worth storing quaternions and vector targets in separate
                // lists. this way the update code won't be forced to check target type before
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
        const targets = this._targets;
        const binder = this._binder;

        const clips = this._clips;
        const clip = clips[index];
        const curves = clip.track.curves;

        for (let i = 0; i < curves.length; ++i) {
            const curve = curves[i];
            const paths = curve.paths;
            for (let j = 0; j < paths.length; ++j) {
                const path = paths[j];

                const target = this._binder.resolve(path);

                if (target) {
                    target.curves--;
                    if (target.curves === 0) {
                        binder.unresolve(path);
                        delete targets[target.targetPath];
                        if (binder.animComponent) {
                            binder.animComponent.targets[target.targetPath].layerCounter--;
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
        const clips = this._clips;
        for (let i = 0; i < clips.length; ++i) {
            const clip = clips[i];
            if (clip.name === name) {
                return clip;
            }
        }
        return null;
    }

    rebind() {
        this._binder.rebind();
        this._targets = {};
        const clips = [...this.clips];
        this.removeClips();
        clips.forEach((clip) => {
            this.addClip(clip);
        });
    }

    assignMask(mask) {
        return this._binder.assignMask(mask);
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
        const clips = this._clips;

        // stable sort order
        const order = clips.map(function (c, i) {
            return i;
        });
        AnimEvaluator._stableSort(order, function (a, b) {
            return clips[a].blendOrder < clips[b].blendOrder;
        });

        for (let i = 0; i < order.length; ++i) {
            const index = order[i];
            const clip = clips[index];
            const inputs = this._inputs[index];
            const outputs = this._outputs[index];
            const blendWeight = clip.blendWeight;

            // update clip
            if (blendWeight > 0.0) {
                clip._update(deltaTime);
            }

            let input;
            let output;
            let value;

            if (blendWeight >= 1.0) {
                for (let j = 0; j < inputs.length; ++j) {
                    input = inputs[j];
                    output = outputs[j];
                    value = output.value;

                    AnimEvaluator._set(value, input, output.target.type);

                    output.blendCounter++;
                }
            } else if (blendWeight > 0.0) {
                for (let j = 0; j < inputs.length; ++j) {
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
        const targets = this._targets;
        const binder = this._binder;
        for (const path in targets) {
            if (targets.hasOwnProperty(path)) {
                const target = targets[path];
                // if this evaluator is associated with an anim component then we should blend the result of this evaluator with all other anim layer's evaluators
                if (binder.animComponent && target.target.isTransform) {
                    const animTarget = binder.animComponent.targets[path];
                    if (animTarget.counter === animTarget.layerCounter) {
                        animTarget.counter = 0;
                    }

                    // Add this layer's value onto the target value
                    animTarget.updateValue(binder.layerIndex, target.value);

                    // update the target property using this new value
                    target.target.func(animTarget.value);
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
        binder.update(deltaTime);
    }
}

export { AnimEvaluator };
