import { AnimClip } from '../evaluator/anim-clip.js';
import { AnimState } from './anim-state.js';
import { AnimNode } from './anim-node.js';
import { AnimTransition } from './anim-transition.js';
import {
    ANIM_GREATER_THAN, ANIM_LESS_THAN, ANIM_GREATER_THAN_EQUAL_TO, ANIM_LESS_THAN_EQUAL_TO, ANIM_EQUAL_TO, ANIM_NOT_EQUAL_TO,
    ANIM_INTERRUPTION_NONE, ANIM_INTERRUPTION_PREV, ANIM_INTERRUPTION_NEXT, ANIM_INTERRUPTION_PREV_NEXT, ANIM_INTERRUPTION_NEXT_PREV,
    ANIM_PARAMETER_TRIGGER,
    ANIM_STATE_START, ANIM_STATE_END, ANIM_STATE_ANY, ANIM_CONTROL_STATES
} from './constants.js';

/**
 * @private
 * @class
 * @name AnimController
 * @classdesc The AnimController manages the animations for it's entity, based on the provided state graph and parameters. It's update method determines which state the controller should be in based on the current time, parameters and available states / transitions. It also ensures the AnimEvaluator is supplied with the correct animations, based on the currently active state.
 * @description Create a new AnimController.
 * @param {AnimEvaluator} animEvaluator - The animation evaluator used to blend all current playing animation keyframes and update the entities properties based on the current animation values.
 * @param {object[]} states - The list of states used to form the controller state graph.
 * @param {object[]} transitions - The list of transitions used to form the controller state graph.
 * @param {object[]} parameters - The anim components parameters.
 * @param {boolean} activate - Determines whether the anim controller should automatically play once all {@link AnimNodes} are assigned animations.
 */
class AnimController {
    constructor(animEvaluator, states, transitions, parameters, activate, eventHandler) {
        this._animEvaluator = animEvaluator;
        this._states = {};
        this._stateNames = [];
        this._eventHandler = eventHandler;
        for (let i = 0; i < states.length; i++) {
            this._states[states[i].name] = new AnimState(
                this,
                states[i].name,
                states[i].speed,
                states[i].loop,
                states[i].blendTree
            );
            this._stateNames.push(states[i].name);
        }
        this._transitions = transitions.map((transition) => {
            return new AnimTransition({
                ...transition
            });
        });
        this._findTransitionsFromStateCache = {};
        this._findTransitionsBetweenStatesCache = {};
        this._parameters = parameters;
        this._previousStateName = null;
        this._activeStateName = ANIM_STATE_START;
        this._playing = false;
        this._activate = activate;

        this._currTransitionTime = 1.0;
        this._totalTransitionTime = 1.0;
        this._isTransitioning = false;
        this._transitionInterruptionSource = ANIM_INTERRUPTION_NONE;
        this._transitionPreviousStates = [];

        this._timeInState = 0;
        this._timeInStateBefore = 0;
    }

    get animEvaluator() {
        return this._animEvaluator;
    }

    get activeState() {
        return this._findState(this._activeStateName);
    }

    set activeState(stateName) {
        this._activeStateName = stateName;
    }

    get activeStateName() {
        return this._activeStateName;
    }

    get activeStateAnimations() {
        return this.activeState.animations;
    }

    get previousState() {
        return this._findState(this._previousStateName);
    }

    set previousState(stateName) {
        this._previousStateName = stateName;
    }

    get previousStateName() {
        return this._previousStateName;
    }

    get playable() {
        let playable = true;
        for (let i = 0; i < this._stateNames.length; i++) {
            if (!this._states[this._stateNames[i]].playable) {
                playable = false;
            }
        }
        return playable;
    }

    get playing() {
        return this._playing;
    }

    set playing(value) {
        this._playing = value;
    }

    get activeStateProgress() {
        return this._getActiveStateProgressForTime(this._timeInState);
    }

    get activeStateDuration() {
        if (this.activeStateName === ANIM_STATE_START || this.activeStateName === ANIM_STATE_END)
            return 0.0;

        let maxDuration = 0.0;
        for (let i = 0; i < this.activeStateAnimations.length; i++) {
            const activeClip = this._animEvaluator.findClip(this.activeStateAnimations[i].name);
            if (activeClip) {
                maxDuration = Math.max(maxDuration, activeClip.track.duration);
            }
        }
        return maxDuration;
    }

    get activeStateCurrentTime() {
        return this._timeInState;
    }

    set activeStateCurrentTime(time) {
        this._timeInStateBefore = time;
        this._timeInState = time;
        for (let i = 0; i < this.activeStateAnimations.length; i++) {
            const clip = this.animEvaluator.findClip(this.activeStateAnimations[i].name);
            if (clip) {
                clip.time = time;
            }
        }
    }

    get transitioning() {
        return this._isTransitioning;
    }

    get transitionProgress() {
        return this._currTransitionTime / this._totalTransitionTime;
    }

    get states() {
        return this._stateNames;
    }

    _findState(stateName) {
        return this._states[stateName];
    }

    _getActiveStateProgressForTime(time) {
        if (this.activeStateName === ANIM_STATE_START || this.activeStateName === ANIM_STATE_END || this.activeStateName === ANIM_STATE_ANY)
            return 1.0;

        const activeClip = this._animEvaluator.findClip(this.activeStateAnimations[0].name);
        if (activeClip) {
            return time / activeClip.track.duration;
        }

        return null;
    }

    // return all the transitions that have the given stateName as their source state
    _findTransitionsFromState(stateName) {
        let transitions = this._findTransitionsFromStateCache[stateName];
        if (!transitions) {
            transitions = this._transitions.filter(function (transition) {
                return transition.from === stateName;
            });

            // sort transitions in priority order
            transitions.sort(function (a, b) {
                return a.priority < b.priority;
            });

            this._findTransitionsFromStateCache[stateName] = transitions;
        }
        return transitions;
    }

    // return all the transitions that contain the given source and destination states
    _findTransitionsBetweenStates(sourceStateName, destinationStateName) {
        let transitions = this._findTransitionsBetweenStatesCache[sourceStateName + '->' + destinationStateName];
        if (!transitions) {
            transitions = this._transitions.filter(function (transition) {
                return transition.from === sourceStateName && transition.to === destinationStateName;
            });

            // sort transitions in priority order
            transitions.sort(function (a, b) {
                return a.priority < b.priority;
            });

            this._findTransitionsBetweenStatesCache[sourceStateName + '->' + destinationStateName] = transitions;
        }
        return transitions;
    }

    _transitionHasConditionsMet(transition) {
        let conditionsMet = true;
        for (let i = 0; i < transition.conditions.length; i++) {
            const condition = transition.conditions[i];
            const parameter = this.findParameter(condition.parameterName);
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

    _findTransition(from, to) {
        let transitions = [];

        // If from and to are supplied, find transitions that include the required source and destination states
        if (from && to) {
            transitions.concat(this._findTransitionsBetweenStates(from, to));
        } else {
            // If no transition is active, look for transitions from the active & any states.
            if (!this._isTransitioning) {
                transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
            } else {
                // Otherwise look for transitions from the previous and active states based on the current interruption source.
                // Accept transitions from the any state unless the interruption source is set to none
                switch (this._transitionInterruptionSource) {
                    case ANIM_INTERRUPTION_PREV:
                        transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
                        transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
                        break;
                    case ANIM_INTERRUPTION_NEXT:
                        transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                        transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
                        break;
                    case ANIM_INTERRUPTION_PREV_NEXT:
                        transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
                        transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                        transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
                        break;
                    case ANIM_INTERRUPTION_NEXT_PREV:
                        transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                        transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
                        transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
                        break;
                    case ANIM_INTERRUPTION_NONE:
                    default:
                }
            }
        }

        // filter out transitions that don't have their conditions met
        transitions = transitions.filter(function (transition) {
            // if the transition is moving to the already active state, ignore it
            if (transition.to === this.activeStateName) {
                return false;
            }
            // when an exit time is present, we should only exit if it falls within the current frame delta time
            if (transition.hasExitTime) {
                let progressBefore = this._getActiveStateProgressForTime(this._timeInStateBefore);
                let progress = this._getActiveStateProgressForTime(this._timeInState);
                // when the exit time is smaller than 1 and the state is looping, we should check for an exit each loop
                if (transition.exitTime < 1.0 && this.activeState.loop) {
                    progressBefore -= Math.floor(progressBefore);
                    progress -= Math.floor(progress);
                }
                // return false if exit time isn't within the frames delta time
                if (!(transition.exitTime > progressBefore && transition.exitTime <= progress)) {
                    return null;
                }
            }
            // if the exitTime condition has been met or is not present, check condition parameters
            return this._transitionHasConditionsMet(transition);
        }.bind(this));

        // return the highest priority transition to use
        if (transitions.length > 0) {
            const transition = transitions[0];
            if (transition.to === ANIM_STATE_END) {
                const startTransition = this._findTransitionsFromState(ANIM_STATE_START)[0];
                transition.to = startTransition.to;
            }
            return transition;
        }
        return null;
    }

    updateStateFromTransition(transition) {
        let state;
        let animation;
        let clip;
        this.previousState = transition.from;
        this.activeState = transition.to;

        // turn off any triggers which were required to activate this transition
        for (let i = 0; i < transition.conditions.length; i++) {
            const condition = transition.conditions[i];
            const parameter = this.findParameter(condition.parameterName);
            if (parameter.type === ANIM_PARAMETER_TRIGGER) {
                parameter.value = false;
            }
        }

        if (this.previousState) {
            if (!this._isTransitioning) {
                this._transitionPreviousStates = [];
            }

            // record the transition source state in the previous states array
            this._transitionPreviousStates.push({
                name: this._previousStateName,
                weight: 1
            });

            // if this new transition was activated during another transition, update the previous transition state weights based
            // on the progress through the previous transition.
            const interpolatedTime = Math.min(this._currTransitionTime / this._totalTransitionTime, 1.0);
            for (let i = 0; i < this._transitionPreviousStates.length; i++) {
                // interpolate the weights of the most recent previous state and all other previous states based on the progress through the previous transition
                if (!this._isTransitioning) {
                    this._transitionPreviousStates[i].weight = 1.0;
                } else if (i !== this._transitionPreviousStates.length - 1) {
                    this._transitionPreviousStates[i].weight *= (1.0 - interpolatedTime);
                } else {
                    this._transitionPreviousStates[i].weight = interpolatedTime;
                }
                state = this._findState(this._transitionPreviousStates[i].name);
                // update the animations of previous states, set their name to include their position in the previous state array
                // to uniquely identify animations from the same state that were added during different transitions
                for (let j = 0; j < state.animations.length; j++) {
                    animation = state.animations[j];
                    clip = this._animEvaluator.findClip(animation.name + '.previous.' + i);
                    if (!clip) {
                        clip = this._animEvaluator.findClip(animation.name);
                        clip.name = animation.name + '.previous.' + i;
                    }
                    // // pause previous animation clips to reduce their impact on performance
                    if (i !== this._transitionPreviousStates.length - 1) {
                        clip.pause();
                    }
                }
            }
        }

        this._isTransitioning = true;
        this._totalTransitionTime = transition.time;
        this._currTransitionTime = 0;
        this._transitionInterruptionSource = transition.interruptionSource;


        const activeState = this.activeState;
        const hasTransitionOffset = transition.transitionOffset && transition.transitionOffset > 0.0 && transition.transitionOffset < 1.0;

        // set the time in the new state to 0 or to a value based on transitionOffset if one was given
        let timeInState = 0;
        let timeInStateBefore = 0;
        if (hasTransitionOffset) {
            const offsetTime = activeState.timelineDuration * transition.transitionOffset;
            timeInState = offsetTime;
            timeInStateBefore = offsetTime;
        }
        this._timeInState = timeInState;
        this._timeInStateBefore = timeInStateBefore;

        // Add clips to the evaluator for each animation in the new state.
        for (let i = 0; i < activeState.animations.length; i++) {
            clip = this._animEvaluator.findClip(activeState.animations[i].name);
            if (!clip) {
                const speed = Number.isFinite(activeState.animations[i].speed) ? activeState.animations[i].speed : activeState.speed;
                clip = new AnimClip(activeState.animations[i].animTrack, this._timeInState, speed, true, activeState.loop, this._eventHandler);
                clip.name = activeState.animations[i].name;
                this._animEvaluator.addClip(clip);
            } else {
                clip.reset();
            }
            if (transition.time > 0) {
                clip.blendWeight = 0.0;
            } else {
                clip.blendWeight = activeState.animations[i].normalizedWeight;
            }
            clip.play();
            if (hasTransitionOffset) {
                clip.time = activeState.timelineDuration * transition.transitionOffset;
            } else {
                const startTime = activeState.speed >= 0 ? 0 : this.activeStateDuration;
                clip.time = startTime;
            }
        }
    }

    _transitionToState(newStateName) {
        if (!this._findState(newStateName)) {
            return;
        }

        // move to the given state, if a transition is present in the state graph use it. Otherwise move instantly to it.
        let transition = this._findTransition(this._activeStateName, newStateName);
        if (!transition) {
            this._animEvaluator.removeClips();
            transition = new AnimTransition({ from: null, to: newStateName });
        }
        this.updateStateFromTransition(transition);
    }

    assignAnimation(pathString, animTrack, speed, loop) {
        const path = pathString.split('.');
        let state = this._findState(path[0]);
        if (!state) {
            state = new AnimState(this, path[0], 1.0);
            this._states[path[0]] = state;
            this._stateNames.push(path[0]);
        }
        state.addAnimation(path, animTrack);
        if (speed !== undefined) {
            state.speed = speed;
        }
        if (loop !== undefined) {
            state.loop = loop;
        }

        if (!this._playing && this._activate && this.playable) {
            this.play();
        }
    }

    removeNodeAnimations(nodeName) {
        if (ANIM_CONTROL_STATES.indexOf(nodeName) !== -1) {
            return;
        }
        const state = this._findState(nodeName);
        if (!state) {
            // #if _DEBUG
            console.error('Attempting to unassign animation tracks from a state that does not exist.');
            // #endif
            return;
        }

        state.animations = [];
        return true;
    }

    play(stateName) {
        if (stateName) {
            this._transitionToState(stateName);
        }
        this._playing = true;
    }

    pause() {
        this._playing = false;
    }

    reset() {
        this._previousStateName = null;
        this._activeStateName = ANIM_STATE_START;
        this._playing = false;
        this._currTransitionTime = 1.0;
        this._totalTransitionTime = 1.0;
        this._isTransitioning = false;
        this._timeInState = 0;
        this._timeInStateBefore = 0;
        this._animEvaluator.removeClips();
    }

    rebind() {
        this._animEvaluator.rebind();
    }

    update(dt) {
        if (!this._playing) {
            return;
        }
        let state;
        let animation;
        let clip;
        this._timeInStateBefore = this._timeInState;
        this._timeInState += dt;

        // transition between states if a transition is available from the active state
        const transition = this._findTransition(this._activeStateName);
        if (transition)
            this.updateStateFromTransition(transition);

        if (this._isTransitioning) {
            this._currTransitionTime += dt;
            if (this._currTransitionTime <= this._totalTransitionTime) {
                const interpolatedTime = this._currTransitionTime / this._totalTransitionTime;
                // while transitioning, set all previous state animations to be weighted by (1.0 - interpolationTime).
                for (let i = 0; i < this._transitionPreviousStates.length; i++) {
                    state = this._findState(this._transitionPreviousStates[i].name);
                    const stateWeight = this._transitionPreviousStates[i].weight;
                    for (let j = 0; j < state.animations.length; j++) {
                        animation = state.animations[j];
                        clip = this._animEvaluator.findClip(animation.name + '.previous.' + i);
                        if (clip) {
                            clip.blendWeight = (1.0 - interpolatedTime) * animation.normalizedWeight * stateWeight;
                        }
                    }
                }
                // while transitioning, set active state animations to be weighted by (interpolationTime).
                state = this.activeState;
                for (let i = 0; i < state.animations.length; i++) {
                    animation = state.animations[i];
                    this._animEvaluator.findClip(animation.name).blendWeight = interpolatedTime * animation.normalizedWeight;
                }
            } else {
                this._isTransitioning = false;
                // when a transition ends, remove all previous state clips from the evaluator
                const activeClips = this.activeStateAnimations.length;
                const totalClips = this._animEvaluator.clips.length;
                for (let i = 0; i < totalClips - activeClips; i++) {
                    this._animEvaluator.removeClip(0);
                }
                this._transitionPreviousStates = [];
                // when a transition ends, set the active state clip weights so they sum to 1
                state = this.activeState;
                for (let i = 0; i < state.animations.length; i++) {
                    animation = state.animations[i];
                    clip = this._animEvaluator.findClip(animation.name);
                    if (clip) {
                        clip.blendWeight = animation.normalizedWeight;
                    }
                }
            }
        } else {
            if (this.activeState._blendTree.constructor !== AnimNode) {
                state = this.activeState;
                for (let i = 0; i < state.animations.length; i++) {
                    animation = state.animations[i];
                    clip = this._animEvaluator.findClip(animation.name);
                    if (clip) {
                        clip.blendWeight = animation.normalizedWeight;
                        if (animation.parent.syncAnimations) {
                            clip.speed = animation.speed;
                        }
                    }
                }
            }
        }
        this._animEvaluator.update(dt);
    }

    findParameter(name) {
        return this._parameters[name];
    }
}

export { AnimController };
