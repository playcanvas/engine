import {
    ANIM_GREATER_THAN, ANIM_LESS_THAN, ANIM_GREATER_THAN_EQUAL_TO, ANIM_LESS_THAN_EQUAL_TO, ANIM_EQUAL_TO, ANIM_NOT_EQUAL_TO,
    ANIM_INTERRUPTION_NONE
} from './constants.js';

/**
 * @private
 * @class
 * @name pc.AnimTransition
 * @classdesc AnimTransitions represent connections in the controllers state graph between AnimStates. During each frame, the controller tests to see if any of the AnimTransitions have the current AnimState as their source (from) state. If so and the AnimTransitions parameter based conditions are met, the controller will transition to the destination state.
 * @description Create a new AnimTransition.
 * @param {pc.AnimController} controller - The controller this AnimTransition is associated with.
 * @param {string} from - The state that this transition will exit from.
 * @param {string} to - The state that this transition will transition to.
 * @param {number} time - The duration of the transition in seconds.
 * @param {number} priority - Used to sort all matching transitions in ascending order. The first transition in the list will be selected.
 * @param {object[]} conditions - A list of conditions which must pass for this transition to be used.
 * @param {number} exitTime - If provided, this transition will only be active for the exact frame during which the source states progress passes the time specified. Given as a normalised value of the source states duration. Values less than 1 will be checked every animation loop.
 * @param {number} transitionOffset - If provided, the destination state will begin playing its animation at this time. Given in normalised time, based on the states duration & must be between 0 and 1.
 * @param {string} interruptionSource - Defines whether another transition can interrupt this one and which of the current or previous states transitions can do so. One of pc.ANIM_INTERRUPTION_*.
 */
class AnimTransition {
    constructor(controller, from, to, time, priority, conditions, exitTime, transitionOffset, interruptionSource = ANIM_INTERRUPTION_NONE) {
        this._controller = controller;
        this._from = from;
        this._to = to;
        this._time = time;
        this._priority = priority;
        this._conditions = conditions || [];
        this._exitTime = exitTime || null;
        this._transitionOffset = transitionOffset || null;
        this._interruptionSource = interruptionSource;
    }

    get from() {
        return this._from;
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

    get hasConditionsMet() {
        var conditionsMet = true;
        var i;
        for (i = 0; i < this.conditions.length; i++) {
            var condition = this.conditions[i];
            var parameter = this._controller.findParameter(condition.parameterName);
            switch (condition.predicate) {
                case ANIM_GREATER_THAN:
                    conditionsMet = conditionsMet && parameter.value > condition.value;
                    break;
                case ANIM_LESS_THAN:
                    conditionsMet = conditionsMet && parameter.value < condition.value;
                    break;
                case ANIM_GREATER_THAN_EQUAL_TO:
                    conditionsMet = conditionsMet && parameter.value >= condition.value;
                    break;
                case ANIM_LESS_THAN_EQUAL_TO:
                    conditionsMet = conditionsMet && parameter.value <= condition.value;
                    break;
                case ANIM_EQUAL_TO:
                    conditionsMet = conditionsMet && parameter.value === condition.value;
                    break;
                case ANIM_NOT_EQUAL_TO:
                    conditionsMet = conditionsMet && parameter.value !== condition.value;
                    break;
            }
            if (!conditionsMet)
                return conditionsMet;
        }
        return conditionsMet;
    }
}

export { AnimTransition };
