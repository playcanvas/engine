import {
    ANIM_INTERRUPTION_NONE
} from './constants.js';

/**
 * AnimTransitions represent connections in the controllers state graph between AnimStates. During
 * each frame, the controller tests to see if any of the AnimTransitions have the current AnimState
 * as their source (from) state. If so and the AnimTransitions parameter based conditions are met,
 * the controller will transition to the destination state.
 *
 * @ignore
 */
class AnimTransition {
    /**
     * Create a new AnimTransition.
     *
     * @param {object} options - Options.
     * @param {string} options.from - The state that this transition will exit from.
     * @param {string} options.to - The state that this transition will transition to.
     * @param {number} [options.time] - The duration of the transition in seconds. Defaults to 0.
     * @param {number} [options.priority] - Used to sort all matching transitions in ascending
     * order. The first transition in the list will be selected. Defaults to 0.
     * @param {object[]} [options.conditions] - A list of conditions which must pass for this
     * transition to be used. Defaults to [].
     * @param {number} [options.exitTime] - If provided, this transition will only be active for
     * the exact frame during which the source states progress passes the time specified. Given as
     * a normalized value of the source states duration. Values less than 1 will be checked every
     * animation loop. Defaults to null.
     * @param {number} [options.transitionOffset] - If provided, the destination state will begin
     * playing its animation at this time. Given in normalized time, based on the state's duration
     * and must be between 0 and 1. Defaults to null.
     * @param {string} [options.interruptionSource] - Defines whether another transition can
     * interrupt this one and which of the current or previous states transitions can do so. One of
     * pc.ANIM_INTERRUPTION_*. Defaults to pc.ANIM_INTERRUPTION_NONE.
     */
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

    set to(value) {
        this._to = value;
    }

    get to() {
        return this._to;
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
