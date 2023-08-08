import { AnimTargetValue } from './anim-target-value.js';
import { AnimBlend } from './anim-blend.js';

/**
 * AnimEvaluator blends multiple sets of animation clips together.
 *
 * @ignore
 */
class AnimEvaluator {
    /**
     * Create a new animation evaluator.
     *
     * @param {import('../binder/anim-binder.js').AnimBinder} binder - interface resolves curve
     * paths to instances of {@link AnimTarget}.
     */
    constructor(binder) {
        this._binder = binder;
        this._clips = [];
        this._inputs = [];
        this._outputs = [];
        this._targets = {};
    }

    /**
     * The list of animation clips.
     *
     * @type {import('./anim-clip.js').AnimClip[]}
     */
    get clips() {
        return this._clips;
    }

    /**
     * Add a clip to the evaluator.
     *
     * @param {import('./anim-clip.js').AnimClip} clip - The clip to add to the evaluator.
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
     * Remove a clip from the evaluator.
     *
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
     * Remove all clips from the evaluator.
     */
    removeClips() {
        while (this._clips.length > 0) {
            this.removeClip(0);
        }
    }

    updateClipTrack(name, animTrack) {
        this._clips.forEach((clip) => {
            if (clip.name.includes(name)) {
                clip.track = animTrack;
            }
        });
        this.rebind();
    }

    /**
     * Returns the first clip which matches the given name, or null if no such clip was found.
     *
     * @param {string} name - Name of the clip to find.
     * @returns {import('./anim-clip.js').AnimClip|null} - The clip with the given name or null if no such clip was found.
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
     * Evaluator frame update function. All the attached {@link AnimClip}s are evaluated, blended
     * and the results set on the {@link AnimTarget}.
     *
     * @param {number} deltaTime - The amount of time that has passed since the last update, in
     * seconds.
     * @param {number} outputAnimation - Whether the evaluator should output the results of the update to the bound animation targets.
     */
    update(deltaTime, outputAnimation = true) {
        // copy clips
        const clips = this._clips;

        // stable sort order
        const order = clips.map(function (c, i) {
            return i;
        });
        AnimBlend.stableSort(order, function (a, b) {
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
            if (!outputAnimation) break;

            let input;
            let output;
            let value;

            if (blendWeight >= 1.0) {
                for (let j = 0; j < inputs.length; ++j) {
                    input = inputs[j];
                    output = outputs[j];
                    value = output.value;

                    AnimBlend.set(value, input, output.target.type);

                    output.blendCounter++;
                }
            } else if (blendWeight > 0.0) {
                for (let j = 0; j < inputs.length; ++j) {
                    input = inputs[j];
                    output = outputs[j];
                    value = output.value;

                    if (output.blendCounter === 0) {
                        AnimBlend.set(value, input, output.target.type);
                    } else {
                        AnimBlend.blend(value, input, blendWeight, output.target.type);
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
                    if (!animTarget.path) {
                        animTarget.path = path;
                        animTarget.baseValue = target.target.get();
                        animTarget.setter = target.target.set;
                    }
                    // Add this layer's value onto the target value
                    animTarget.updateValue(binder.layerIndex, target.value);

                    animTarget.counter++;
                } else {
                    target.target.set(target.value);
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
