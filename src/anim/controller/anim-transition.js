import {
    ANIM_INTERRUPTION_NONE
} from './constants.js';

/**
 * @private
 * @class
 * @name AnimTransition
 * @classdesc AnimTransitions represent connections in the controllers state graph between AnimStates. During each frame, the controller tests to see if any of the AnimTransitions have the current AnimState as their source (from) state. If so and the AnimTransitions parameter based conditions are met, the controller will transition to the destination state.
 * @description Create a new AnimTransition.
 * @param {string} from - The state that this transition will exit from.
 * @param {string} to - The state that this transition will transition to.
 * @param {number} time - The duration of the transition in seconds. Defaults to 0.
 * @param {number} priority - Used to sort all matching transitions in ascending order. The first transition in the list will be selected. Defaults to 0.
 * @param {object[]} conditions - A list of conditions which must pass for this transition to be used. Defaults to [].
 * @param {number} exitTime - If provided, this transition will only be active for the exact frame during which the source states progress passes the time specified. Given as a normalised value of the source states duration. Values less than 1 will be checked every animation loop. Defaults to null.
 * @param {number} transitionOffset - If provided, the destination state will begin playing its animation at this time. Given in normalised time, based on the states duration & must be between 0 and 1. Defaults to null.
 * @param {string} interruptionSource - Defines whether another transition can interrupt this one and which of the current or previous states transitions can do so. One of pc.ANIM_INTERRUPTION_*. Defaults to pc.ANIM_INTERRUPTION_NONE.
 */
class AnimTransition {
    constructor({ from, to, time = 0, priority = 0, conditions = [], exitTime = null, transitionOffset = null, interruptionSource = ANIM_INTERRUPTION_NONE }) {
        this._from = from;
        this._to = to;
        this._time = time;
        this._priority = priority;
        this._conditions = conditions;
        this._exitTime = exitTime;
        this._transitionOffset = transitionOffset;
        this._interruptionSource = interruptionSource;
    }

    get from() {
        return this._from;
    }

    get to() {
        return this._to;
    }

    set to(value) {
        this._to = value;
    }

    get time() {
        return this._time;
    }

    get priority() {
        return this._priority;
    }

    get conditions() {
        return this._conditions;
    }

    get exitTime() {
        return this._exitTime;
    }

    get transitionOffset() {
        return this._transitionOffset;
    }

    get interruptionSource() {
        return this._interruptionSource;
    }

    get hasExitTime() {
        return !!this.exitTime;
    }
}

export { AnimTransition };
