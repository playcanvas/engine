import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';

import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { AnimTransition } from '../../anim/controller/anim-transition.js';
import { ANIM_LAYER_OVERWRITE } from '../../anim/controller/constants.js';

/**
 * The Anim Component Layer allows managers a single layer of the animation state graph.
 *
 * @category Animation
 */
class AnimComponentLayer {
    /**
     * Create a new AnimComponentLayer instance.
     *
     * @param {string} name - The name of the layer.
     * @param {object} controller - The controller to manage this layers animations.
     * @param {import('./component.js').AnimComponent} component - The component that this layer is
     * a member of.
     * @param {number} [weight] - The weight of this layer. Defaults to 1.
     * @param {string} [blendType] - The blend type of this layer. Defaults to {@link ANIM_LAYER_OVERWRITE}.
     * @param {boolean} [normalizedWeight] - Whether the weight of this layer should be normalized
     * using the total weight of all layers.
     */
    constructor(name, controller, component, weight = 1, blendType = ANIM_LAYER_OVERWRITE, normalizedWeight = true) {
        this._name = name;
        this._controller = controller;
        this._component = component;
        this._weight = weight;
        this._blendType = blendType;
        this._normalizedWeight = normalizedWeight;
        this._mask = null;
        this._blendTime = 0;
        this._blendTimeElapsed = 0;
        this._startingWeight = 0;
        this._targetWeight = 0;
    }

    /**
     * Returns the name of the layer.
     *
     * @type {string}
     */
    get name() {
        return this._name;
    }

    /**
     * Whether this layer is currently playing.
     *
     * @type {string}
     */
    set playing(value) {
        this._controller.playing = value;
    }

    get playing() {
        return this._controller.playing;
    }

    /**
     * Returns true if a state graph has been loaded and all states in the graph have been assigned
     * animation tracks.
     *
     * @type {string}
     */
    get playable() {
        return this._controller.playable;
    }

    /**
     * Returns the currently active state name.
     *
     * @type {string}
     */
    get activeState() {
        return this._controller.activeStateName;
    }

    /**
     * Returns the previously active state name.
     *
     * @type {string}
     */
    get previousState() {
        return this._controller.previousStateName;
    }

    /**
     * Returns the currently active states progress as a value normalized by the states animation
     * duration. Looped animations will return values greater than 1.
     *
     * @type {number}
     */
    get activeStateProgress() {
        return this._controller.activeStateProgress;
    }

    /**
     * Returns the currently active states duration.
     *
     * @type {number}
     */
    get activeStateDuration() {
        return this._controller.activeStateDuration;
    }

    /**
     * The active states time in seconds.
     *
     * @type {number}
     */
    set activeStateCurrentTime(time) {
        const controller = this._controller;
        const layerPlaying = controller.playing;
        controller.playing = true;
        controller.activeStateCurrentTime = time;
        if (!layerPlaying) {
            controller.update(0);
        }
        controller.playing = layerPlaying;
    }

    get activeStateCurrentTime() {
        return this._controller.activeStateCurrentTime;
    }

    /**
     * Returns whether the anim component layer is currently transitioning between states.
     *
     * @type {boolean}
     */
    get transitioning() {
        return this._controller.transitioning;
    }

    /**
     * If the anim component layer is currently transitioning between states, returns the progress.
     * Otherwise returns null.
     *
     * @type {number|null}
     */
    get transitionProgress() {
        if (this.transitioning) {
            return this._controller.transitionProgress;
        }
        return null;
    }

    /**
     * Lists all available states in this layers state graph.
     *
     * @type {string[]}
     */
    get states() {
        return this._controller.states;
    }

    /**
     * The blending weight of this layer. Used when calculating the value of properties that are
     * animated by more than one layer.
     *
     * @type {number}
     */
    set weight(value) {
        this._weight = value;
        this._component.dirtifyTargets();
    }

    get weight() {
        return this._weight;
    }

    set blendType(value) {
        if (value !== this._blendType) {
            this._blendType = value;
            if (this._controller.normalizeWeights) {
                this._component.rebind();
            }
        }
    }

    get blendType() {
        return this._blendType;
    }

    /**
     * A mask of bones which should be animated or ignored by this layer.
     *
     * @type {object}
     * @example
     * entity.anim.baseLayer.mask = {
     *     // include the spine of the current model and all of its children
     *     "path/to/spine": {
     *         children: true
     *     },
     *     // include the hip of the current model but not all of its children
     *     "path/to/hip": true
     * };
     */
    set mask(value) {
        if (this._controller.assignMask(value)) {
            this._component.rebind();
        }
        this._mask = value;
    }

    get mask() {
        return this._mask;
    }

    /**
     * Start playing the animation in the current state.
     *
     * @param {string} [name] - If provided, will begin playing from the start of the state with
     * this name.
     */
    play(name) {
        this._controller.play(name);
    }

    /**
     * Pause the animation in the current state.
     */
    pause() {
        this._controller.pause();
    }

    /**
     * Reset the animation component to its initial state, including all parameters. The system
     * will be paused.
     */
    reset() {
        this._controller.reset();
    }

    /**
     * Rebind any animations in the layer to the currently present components and model of the anim
     * components entity.
     */
    rebind() {
        this._controller.rebind();
    }

    update(dt) {
        if (this._blendTime) {
            if (this._blendTimeElapsed < this._blendTime) {
                this.weight = math.lerp(this._startingWeight, this._targetWeight, this._blendTimeElapsed / this._blendTime);
                this._blendTimeElapsed += dt;
            } else {
                this.weight = this._targetWeight;
                this._blendTime = 0;
                this._blendTimeElapsed = 0;
                this._startingWeight = 0;
                this._targetWeight = 0;
            }
        }
        this._controller.update(dt);
    }


    /**
     * Blend from the current weight value to the provided weight value over a given amount of time.
     *
     * @param {number} weight - The new weight value to blend to.
     * @param {number} time - The duration of the blend in seconds.
     */
    blendToWeight(weight, time) {
        this._startingWeight = this.weight;
        this._targetWeight = weight;
        this._blendTime = Math.max(0, time);
        this._blendTimeElapsed = 0;
    }

    /**
     * Add a mask to this layer.
     *
     * @param {object} [mask] - The mask to assign to the layer. If not provided the current mask
     * in the layer will be removed.
     * @example
     * entity.anim.baseLayer.assignMask({
     *     // include the spine of the current model and all of its children
     *     "path/to/spine": {
     *         children: true
     *     },
     *     // include the hip of the current model but not all of its children
     *     "path/to/hip": true
     * });
     * @ignore
     */
    assignMask(mask) {
        Debug.deprecated('The pc.AnimComponentLayer#assignMask function is now deprecated. Assign masks to the pc.AnimComponentLayer#mask property instead.');
        if (this._controller.assignMask(mask)) {
            this._component.rebind();
        }
        this._mask = mask;
    }

    /**
     * Assigns an animation track to a state or blend tree node in the current graph. If a state
     * for the given nodePath doesn't exist, it will be created. If all states nodes are linked and
     * the {@link AnimComponent#activate} value was set to true then the component will begin
     * playing.
     *
     * @param {string} nodePath - Either the state name or the path to a blend tree node that this
     * animation should be associated with. Each section of a blend tree path is split using a
     * period (`.`) therefore state names should not include this character (e.g "MyStateName" or
     * "MyStateName.BlendTreeNode").
     * @param {object} animTrack - The animation track that will be assigned to this state and
     * played whenever this state is active.
     * @param {number} [speed] - Update the speed of the state you are assigning an animation to.
     * Defaults to 1.
     * @param {boolean} [loop] - Update the loop property of the state you are assigning an
     * animation to. Defaults to true.
     */
    assignAnimation(nodePath, animTrack, speed, loop) {
        if (!(animTrack instanceof AnimTrack)) {
            Debug.error('assignAnimation: animTrack supplied to function was not of type AnimTrack');
            return;
        }
        this._controller.assignAnimation(nodePath, animTrack, speed, loop);
        if (this._controller._transitions.length === 0) {
            this._controller._transitions.push(new AnimTransition({
                from: 'START',
                to: nodePath
            }));
        }
        if (this._component.activate && this._component.playable) {
            this._component.playing = true;
        }
    }

    /**
     * Removes animations from a node in the loaded state graph.
     *
     * @param {string} nodeName - The name of the node that should have its animation tracks removed.
     */
    removeNodeAnimations(nodeName) {
        if (this._controller.removeNodeAnimations(nodeName)) {
            this._component.playing = false;
        }
    }

    /**
     * Returns the asset that is associated with the given state.
     *
     * @param {string} stateName - The name of the state to get the asset for.
     * @returns {import('../../asset/asset.js').Asset} The asset associated with the given state.
     */
    getAnimationAsset(stateName) {
        return this._component.animationAssets[`${this.name}:${stateName}`];
    }

    /**
     * Transition to any state in the current layers graph. Transitions can be instant or take an
     * optional blend time.
     *
     * @param {string} to - The state that this transition will transition to.
     * @param {number} [time] - The duration of the transition in seconds. Defaults to 0.
     * @param {number} [transitionOffset] - If provided, the destination state will begin playing
     * its animation at this time. Given in normalized time, based on the states duration & must be
     * between 0 and 1. Defaults to null.
     */
    transition(to, time = 0, transitionOffset = null) {
        this._controller.updateStateFromTransition(new AnimTransition({
            from: this._controller.activeStateName,
            to,
            time,
            transitionOffset
        }));
    }
}

export { AnimComponentLayer };
