import { AnimTrack } from '../../../anim/evaluator/anim-track.js';
import { AnimTransition } from '../../../anim/controller/anim-transition.js';
import { ANIM_LAYER_OVERWRITE } from '../../../anim/controller/constants.js';


/**
 * @class
 * @name AnimComponentLayer
 * @classdesc The Anim Component Layer allows managers a single layer of the animation state graph.
 * @description Create a new AnimComponentLayer.
 * @param {string} name - The name of the layer.
 * @param {object} controller - The controller to manage this layers animations.
 * @param {AnimComponent} component - The component that this layer is a member of.
 * @param {number} weight - The weight of this layer. Defaults to 1.
 */
class AnimComponentLayer {
    constructor(name, controller, component, weight = 1, blendType = ANIM_LAYER_OVERWRITE) {
        this._name = name;
        this._controller = controller;
        this._component = component;
        this._weight = weight;
        this._blendType = blendType;
        this._mask = null;
    }

    /**
     * @function
     * @name AnimComponentLayer#play
     * @description Start playing the animation in the current state.
     * @param {string} [name] - If provided, will begin playing from the start of the state with this name.
     */
    play(name) {
        this._controller.play(name);
    }

    /**
     * @function
     * @name AnimComponentLayer#pause
     * @description Pause the animation in the current state.
     */
    pause() {
        this._controller.pause();
    }

    /**
     * @function
     * @name AnimComponentLayer#reset
     * @description Reset the animation component to its initial state, including all parameters. The system will be paused.
     */
    reset() {
        this._controller.reset();
    }

    /**
     * @function
     * @name AnimComponentLayer#rebind
     * @description Rebind any animations in the layer to the currently present components and model of the anim components entity.
     */
    rebind() {
        this._controller.rebind();
    }

    update(dt) {
        this._controller.update(dt);
    }

    /**
     * @function
     * @name AnimComponentLayer#assignMask
     * @description Add a mask to this layer.
     * @param {object} [mask] - The mask to assign to the layer. If not provided the current mask in the layer will be removed.
     * @example
     * entity.anim.baseLayer.assignMask({
     *     // include the spine of the current model and all of its children
     *     "path/to/spine": {
     *         children: true
     *     },
     *     // include the hip of the current model but not all of its children
     *     "path/to/hip": true
     * });
     */
    assignMask(mask) {
        if (this._controller.assignMask(mask)) {
            this._component.rebind();
        }
        this._mask = mask;
    }

    get mask() {
        return this._mask;
    }

    /**
     * @function
     * @name AnimComponentLayer#assignAnimation
     * @description Assigns an animation track to a state in the current graph. If a state for the given nodeName doesn't exist, it will be created. If all states nodes are linked and the {@link AnimComponent#activate} value was set to true then the component will begin playing.
     * @param {string} nodeName - The name of the node that this animation should be associated with.
     * @param {object} animTrack - The animation track that will be assigned to this state and played whenever this state is active.
     * @param {number} [speed] - Update the speed of the state you are assigning an animation to. Defaults to 1.
     * @param {boolean} [loop] - Update the loop property of the state you are assigning an animation to. Defaults to true.
     */
    assignAnimation(nodeName, animTrack, speed, loop) {
        if (animTrack.constructor !== AnimTrack) {
            // #if _DEBUG
            console.error('assignAnimation: animTrack supplied to function was not of type AnimTrack');
            // #endif
            return;
        }
        this._controller.assignAnimation(nodeName, animTrack, speed, loop);
        if (this._controller._transitions.length === 0) {
            this._controller._transitions.push(new AnimTransition({
                from: 'START',
                to: nodeName
            }));
        }
        if (this._component.activate && this._component.playable) {
            this._component.playing = true;
        }
    }

    /**
     * @function
     * @name AnimComponentLayer#removeNodeAnimations
     * @description Removes animations from a node in the loaded state graph.
     * @param {string} nodeName - The name of the node that should have its animation tracks removed.
     */
    removeNodeAnimations(nodeName) {
        if (this._controller.removeNodeAnimations(nodeName)) {
            this._component.playing = false;
        }
    }

    /**
     * @function
     * @name AnimComponentLayer#transition
     * @description Transition to any state in the current layers graph. Transitions can be instant or take an optional blend time.
     * @param {string} to - The state that this transition will transition to.
     * @param {number} [time] - The duration of the transition in seconds. Defaults to 0.
     * @param {number} [transitionOffset] - If provided, the destination state will begin playing its animation at this time. Given in normalized time, based on the states duration & must be between 0 and 1. Defaults to null.
     */
    transition(to, time = 0, transitionOffset = null) {
        this._controller.updateStateFromTransition(new AnimTransition({
            from: this._controller.activeStateName,
            to,
            time,
            transitionOffset
        }));
    }

    /**
     * @readonly
     * @name AnimComponentLayer#name
     * @type {string}
     * @description Returns the name of the layer.
     */
    get name() {
        return this._name;
    }

    /**
     * @name AnimComponentLayer#playing
     * @type {string}
     * @description Whether this layer is currently playing.
     */
    get playing() {
        return this._controller.playing;
    }

    set playing(value) {
        this._controller.playing = value;
    }

    /**
     * @readonly
     * @name AnimComponentLayer#playable
     * @type {string}
     * @description Returns true if a state graph has been loaded and all states in the graph have been assigned animation tracks.
     */
    get playable() {
        return this._controller.playable;
    }

    /**
     * @readonly
     * @name AnimComponentLayer#activeState
     * @type {string}
     * @description Returns the currently active state name.
     */
    get activeState() {
        return this._controller.activeStateName;
    }

    /**
     * @readonly
     * @name AnimComponentLayer#previousState
     * @type {string}
     * @description Returns the previously active state name.
     */
    get previousState() {
        return this._controller.previousStateName;
    }

    /**
     * @readonly
     * @name AnimComponentLayer#activeStateProgress
     * @type {number}
     * @description Returns the currently active states progress as a value normalized by the states animation duration. Looped animations will return values greater than 1.
     */
    get activeStateProgress() {
        return this._controller.activeStateProgress;
    }

    /**
     * @readonly
     * @name AnimComponentLayer#activeStateDuration
     * @type {number}
     * @description Returns the currently active states duration.
     */
    get activeStateDuration() {
        return this._controller.activeStateDuration;
    }

    /**
     * @name AnimComponentLayer#activeStateCurrentTime
     * @type {number}
     * @description The active states time in seconds.
     */
    get activeStateCurrentTime() {
        return this._controller.activeStateCurrentTime;
    }

    set activeStateCurrentTime(time) {
        this._controller.activeStateCurrentTime = time;
    }

    /**
     * @readonly
     * @name AnimComponentLayer#transitioning
     * @type {boolean}
     * @description Returns whether the anim component layer is currently transitioning between states.
     */
    get transitioning() {
        return this._controller.transitioning;
    }

    /**
     * @readonly
     * @name AnimComponentLayer#transitionProgress
     * @type {number}
     * @description If the anim component layer is currently transitioning between states, returns the progress. Otherwise returns null.
     */
    get transitionProgress() {
        if (this.transitioning) {
            return this._controller.transitionProgress;
        }
        return null;
    }

    /**
     * @readonly
     * @name AnimComponentLayer#states
     * @type {string[]}
     * @description Lists all available states in this layers state graph.
     */
    get states() {
        return this._controller.states;
    }

    /**
     * @name AnimComponentLayer#weight
     * @type {number}
     * @description The blending weight of this layer. Used when calculating the value of properties that are animated by more than one layer.
     */
    get weight() {
        return this._weight;
    }

    set weight(value) {
        this._weight = value;
        this._component.dirtifyTargets();
    }

    get blendType() {
        return this._blendType;
    }

    set blendType(value) {
        if (value !== this._blendType) {
            this._blendType = value;
            this._component.rebind();
        }
    }
}

export { AnimComponentLayer };
