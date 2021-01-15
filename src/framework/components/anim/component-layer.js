import { AnimTrack } from '../../../anim/evaluator/anim-track.js';

/**
 * @private
 * @class
 * @name pc.AnimComponentLayer
 * @classdesc The Anim Component Layer allows managers a single layer of the animation state graph.
 * @description Create a new AnimComponentLayer.
 * @param {string} name - The name of the layer.
 * @param {object} controller - The controller to manage this layers animations.
 * @param {pc.AnimComponent} component - The component that this layer is a member of.
 */
class AnimComponentLayer {
    constructor(name, controller, component) {
        this._name = name;
        this._controller = controller;
        this._component = component;
    }

    /**
     * @private
     * @function
     * @name pc.AnimComponentLayer#play
     * @description Start playing the animation in the current state.
     * @param {string} [name] - If provided, will begin playing from the start of the state with this name.
     */
    play(name) {
        this._controller.play(name);
    }

    /**
     * @private
     * @function
     * @name pc.AnimComponentLayer#pause
     * @description Start playing the animation in the current state.
     */
    pause() {
        this._controller.pause();
    }

    /**
     * @private
     * @function
     * @name pc.AnimComponentLayer#reset
     * @description Reset the animation component to it's initial state, including all parameters. The system will be paused.
     */
    reset() {
        this._controller.reset();
    }

    update(dt) {
        this._controller.update(dt);
    }

    /**
     * @private
     * @function
     * @name pc.AnimComponentLayer#assignAnimation
     * @description Associates an animation with a state node in the loaded state graph. If all states nodes are linked and the pc.AnimComponent.activate value was set to true then the component will begin playing.
     * @param {string} nodeName - The name of the node that this animation should be associated with.
     * @param {object} animTrack - The animation track that will be assigned to this state and played whenever this state is active.
     */
    assignAnimation(nodeName, animTrack) {
        if (animTrack.constructor !== AnimTrack) {
            // #ifdef DEBUG
            console.error('assignAnimation: animTrack supplied to function was not of type AnimTrack');
            // #endif
            return;
        }
        this._controller.assignAnimation(nodeName, animTrack);
        if (this._component.activate && this._component.playable) {
            this._component.playing = true;
        }
    }

    /**
     * @private
     * @function
     * @name pc.AnimComponentLayer#removeNodeAnimations
     * @description Removes animations from a node in the loaded state graph.
     * @param {string} nodeName - The name of the node that should have its animation tracks removed.
     */
    removeNodeAnimations(nodeName) {
        this._controller.removeNodeAnimations(nodeName);
        this._component.playing = false;
    }

    /**
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#name
     * @type {string}
     * @description Returns the name of the layer
     */
    get name() {
        return this._name;
    }

    /**
     * @private
     * @name pc.AnimComponentLayer#playing
     * @type {string}
     * @description Whether this layer is currently playing
     */
    get playing() {
        return this._controller.playing;
    }

    set playing(value) {
        this._controller.playing = value;
    }

    /**
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#playable
     * @type {string}
     * @description Returns true if a state graph has been loaded and all states in the graph have been assigned animation tracks.
     */
    get playable() {
        return this._controller.playable;
    }

    /**
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#activeState
     * @type {string}
     * @description Returns the currently active state name.
     */
    get activeState() {
        return this._controller.activeStateName;
    }

    /**
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#previousState
     * @type {string}
     * @description Returns the previously active state name.
     */
    get previousState() {
        return this._controller.previousStateName;
    }

    /**
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#activeStateProgress
     * @type {number}
     * @description Returns the currently active states progress as a value normalised by the states animation duration. Looped animations will return values greater than 1.
     */
    get activeStateProgress() {
        return this._controller.activeStateProgress;
    }

    /**
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#activeStateDuration
     * @type {number}
     * @description Returns the currently active states duration.
     */
    get activeStateDuration() {
        return this._controller.activeStateDuration;
    }

    /**
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#activeStateCurrentTime
     * @type {number}
     * @description The active states time in seconds
     */
    get activeStateCurrentTime() {
        return this._controller.activeStateCurrentTime;
    }

    set activeStateCurrentTime(time) {
        this._controller.activeStateCurrentTime = time;
    }

    /**
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#transitioning
     * @type {boolean}
     * @description Returns whether the anim component layer is currently transitioning between states.
     */
    get transitioning() {
        return this._controller.transitioning;
    }

    /**
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#transitionProgress
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
     * @private
     * @readonly
     * @name pc.AnimComponentLayer#states
     * @type {string[]}
     * @description Lists all available states in this layers state graph
     */
    get states() {
        return this._controller.states;
    }
}

export { AnimComponentLayer };
