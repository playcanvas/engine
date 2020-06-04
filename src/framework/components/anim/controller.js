Object.assign(pc, function () {

    var AnimState = function (controller, name, speed) {
        this._controller = controller;
        this._name = name;
        this._animations = [];
        this._speed = speed || 1.0;
    };

    Object.defineProperties(AnimState.prototype, {
        name: {
            get: function () {
                return this._name;
            }
        },
        animations: {
            get: function () {
                return this._animations;
            }
        },
        speed: {
            get: function () {
                return this._speed;
            }
        },
        playable: {
            get: function () {
                return (this.animations.length > 0 || this.name === pc.ANIM_STATE_START || this.name === pc.ANIM_STATE_END);
            }
        },
        looping: {
            get: function () {
                if (this.animations.length > 0) {
                    var trackClipName = this.name + '.' + this.animations[0].animTrack.name;
                    var trackClip = this._controller.animEvaluator.findClip(trackClipName);
                    if (trackClip) {
                        return trackClip.loop;
                    }
                }
                return false;
            }
        },
        totalWeight: {
            get: function () {
                var sum = 0;
                var i;
                for (i = 0; i < this.animations.length; i++) {
                    sum += this.animations[i].weight;
                }
                return sum;
            }
        },
        timelineDuration: {
            get: function () {
                var duration = 0;
                var i;
                for (i = 0; i < this.animations.length; i++) {
                    var animation = this.animations[i];
                    if (animation.animTrack.duration > duration) {
                        duration = animation.animTrack.duration > duration;
                    }
                }
                return duration;
            }
        }
    });

    var AnimTransition = function (controller, from, to, time, priority, conditions, exitTime, transitionOffset, interruptionSource) {
        this._controller = controller;
        this._from = from;
        this._to = to;
        this._time = time;
        this._priority = priority;
        this._conditions = conditions || [];
        this._exitTime = exitTime || null;
        this._transitionOffset = transitionOffset || null;
        this._interruptionSource = interruptionSource || pc.ANIM_INTERRUPTION_NONE;
    };

    Object.defineProperties(AnimTransition.prototype, {
        from: {
            get: function () {
                return this._from;
            }
        },
        to: {
            get: function () {
                return this._to;
            }
        },
        time: {
            get: function () {
                return this._time;
            }
        },
        priority: {
            get: function () {
                return this._priority;
            }
        },
        conditions: {
            get: function () {
                return this._conditions;
            }
        },
        exitTime: {
            get: function () {
                return this._exitTime;
            }
        },
        transitionOffset: {
            get: function () {
                return this._transitionOffset;
            }
        },
        interruptionSource: {
            get: function () {
                return this._interruptionSource;
            }
        },
        hasExitTime: {
            get: function () {
                return !!this.exitTime;
            }
        },
        hasConditionsMet: {
            get: function () {
                var conditionsMet = true;
                var i;
                for (i = 0; i < this.conditions.length; i++) {
                    var condition = this.conditions[i];
                    var parameter = this._controller.findParameter(condition.parameterName);
                    switch (condition.predicate) {
                        case pc.ANIM_GREATER_THAN:
                            conditionsMet = conditionsMet && parameter.value > condition.value;
                            break;
                        case pc.ANIM_LESS_THAN:
                            conditionsMet = conditionsMet && parameter.value < condition.value;
                            break;
                        case pc.ANIM_GREATER_THAN_EQUAL_TO:
                            conditionsMet = conditionsMet && parameter.value >= condition.value;
                            break;
                        case pc.ANIM_LESS_THAN_EQUAL_TO:
                            conditionsMet = conditionsMet && parameter.value <= condition.value;
                            break;
                        case pc.ANIM_EQUAL_TO:
                            conditionsMet = conditionsMet && parameter.value === condition.value;
                            break;
                        case pc.ANIM_NOT_EQUAL_TO:
                            conditionsMet = conditionsMet && parameter.value !== condition.value;
                            break;
                    }
                    if (!conditionsMet)
                        return conditionsMet;
                }
                return conditionsMet;
            }
        }
    });

    var AnimController = function (animEvaluator, states, transitions, parameters, activate) {
        this._animEvaluator = animEvaluator;
        this._states = {};
        this._stateNames = [];
        var i;
        for (i = 0; i < states.length; i++) {
            this._states[states[i].name] = new AnimState(
                this,
                states[i].name,
                states[i].speed
            );
            this._stateNames.push(states[i].name);
        }
        this._transitions = transitions.map(function (transition) {
            return new AnimTransition(
                this,
                transition.from,
                transition.to,
                transition.time,
                transition.priority,
                transition.conditions,
                transition.exitTime,
                transition.transitionOffset,
                transition.interruptionSource
            );
        }.bind(this));
        this._findTransitionsFromStateCache = {};
        this._findTransitionsBetweenStatesCache = {};
        this._parameters = parameters;
        this._previousStateName = null;
        this._activeStateName = pc.ANIM_STATE_START;
        this._playing = false;
        this._activate = activate;

        this._currTransitionTime = 1.0;
        this._totalTransitionTime = 1.0;
        this._isTransitioning = false;
        this._transitionInterruptionSource = pc.ANIM_INTERRUPTION_NONE;
        this._transitionPreviousStates = [];

        this._timeInState = 0;
        this._timeInStateBefore = 0;
    };

    Object.defineProperties(AnimController.prototype, {
        animEvaluator: {
            get: function () {
                return this._animEvaluator;
            }
        },
        activeState: {
            get: function () {
                return this._findState(this._activeStateName);
            },
            set: function (stateName) {
                this._activeStateName = stateName;
            }
        },
        activeStateName: {
            get: function () {
                return this._activeStateName;
            }
        },
        previousState: {
            get: function () {
                return this._findState(this._previousStateName);
            },
            set: function (stateName) {
                this._previousStateName = stateName;
            }
        },
        previousStateName: {
            get: function () {
                return this._previousStateName;
            }
        },
        playable: {
            get: function () {
                var playable = true;
                var i;
                for (i = 0; i < this.states.length; i++) {
                    if (!this._states[this.states[i]].playable) {
                        playable = false;
                    }
                }
                return playable;
            }
        },
        activeStateProgress: {
            get: function () {
                return this._getActiveStateProgressForTime(this._timeInState);
            }
        },
        transitioning: {
            get: function () {
                return this._isTransitioning;
            }
        },
        transitionProgress: {
            get: function () {
                return this._currTransitionTime / this._totalTransitionTime;
            }
        },
        states: {
            get: function () {
                return this._stateNames;
            }
        }
    });

    Object.assign(AnimController.prototype, {

        _findState: function (stateName) {
            return this._states[stateName];
        },

        _getActiveStateProgressForTime: function (time) {
            if (this.activeStateName === pc.ANIM_STATE_START || this.activeStateName === pc.ANIM_STATE_END)
                return 1.0;

            var activeClip = this._animEvaluator.findClip(this.activeState.animations[0].name);
            if (activeClip) {
                return time / activeClip.track.duration;
            }

            return null;
        },

        // return all the transitions that have the given stateName as their source state
        _findTransitionsFromState: function (stateName) {
            var transitions = this._findTransitionsFromStateCache[stateName];
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
        },

        // return all the transitions that contain the given source and destination states
        _findTransitionsBetweenStates: function (sourceStateName, destinationStateName) {
            var transitions = this._findTransitionsBetweenStatesCache[sourceStateName + '->' + destinationStateName];
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
        },

        _findTransition: function (from, to) {
            var transitions = [];

            if (from && to) {
                // find transitions that include the required source and destination states if from and to is supplied
                transitions.concat(this._findTransitionsBetweenStates(this._activeStateName));
            } else {
                // otherwise look for transitions from the previous and active states based on the current interruption source
                if (!this._isTransitioning) {
                    transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                } else {
                    switch (this._transitionInterruptionSource) {
                        case pc.ANIM_INTERRUPTION_PREV:
                            transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
                            break;
                        case pc.ANIM_INTERRUPTION_NEXT:
                            transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                            break;
                        case pc.ANIM_INTERRUPTION_PREV_NEXT:
                            transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
                            transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                            break;
                        case pc.ANIM_INTERRUPTION_NEXT_PREV:
                            transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                            transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
                            break;
                        case pc.ANIM_INTERRUPTION_NONE:
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
                    var progressBefore = this._getActiveStateProgressForTime(this._timeInStateBefore);
                    var progress = this._getActiveStateProgressForTime(this._timeInState);
                    // when the exit time is smaller than 1 and the state is looping, we should check for an exit each loop
                    if (transition.exitTime < 1.0 && this.activeState.looping) {
                        progressBefore -= Math.floor(progressBefore);
                        progress -= Math.floor(progress);
                    }
                    // return false if exit time isn't within the frames delta time
                    if (!(transition.exitTime > progressBefore && transition.exitTime <= progress)) {
                        return null;
                    }
                }
                // if the exitTime condition has been met or is not present, check condition parameters
                return transition.hasConditionsMet;
            }.bind(this));

            // return the highest priority transition to use
            if (transitions.length > 0) {
                return transitions[0];
            }
            return null;

        },

        _updateStateFromTransition: function (transition) {
            var i;
            var j;
            var state;
            var animation;
            var clip;
            this.previousState = transition.from;
            this.activeState = transition.to;

            // turn off any triggers which were required to activate this transition
            for (i = 0; i < transition.conditions.length; i++) {
                var condition = transition.conditions[i];
                var parameter = this.findParameter(condition.parameterName);
                if (parameter.type === pc.ANIM_PARAMETER_TRIGGER) {
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
                var interpolatedTime = this._currTransitionTime / this._totalTransitionTime;
                for (i = 0; i < this._transitionPreviousStates.length; i++) {
                    // interpolate the weights of the most recent previous state and all other previous states based on the progress through the previous transition
                    if (i !== this._transitionPreviousStates.length - 1) {
                        this._transitionPreviousStates[i].weight *= (1.0 - interpolatedTime);
                    } else {
                        this._transitionPreviousStates[i].weight = interpolatedTime;
                    }
                    state = this._findState(this._transitionPreviousStates[i].name);
                    // update the animations of previous states, set their name to include their position in the previous state array
                    // to uniquely identify animations from the same state that were added during different transitions
                    for (j = 0; j < state.animations.length; j++) {
                        animation = state.animations[j];
                        clip = this._animEvaluator.findClip(animation.name + '.previous.' + i);
                        if (!clip) {
                            clip = this._animEvaluator.findClip(animation.name);
                            clip.name = animation.name + '.previous.' + i;
                        }
                        // // pause previous animation clips to reduce their impact on performance
                        // if (i !== this._transitionPreviousStates.length - 1) {
                        clip.pause();
                        // }
                    }
                }
            }

            // start a new transition based on the current transitions information
            if (transition.time > 0) {
                this._isTransitioning = true;
                this._totalTransitionTime = transition.time;
                this._currTransitionTime = 0;
                this._transitionInterruptionSource = transition.interruptionSource;
            }

            var hasTransitionOffset = transition.transitionOffset && transition.transitionOffset > 0.0 && transition.transitionOffset < 1.0;
            var activeState = this.activeState;
            // Add clips to the evaluator for each animation in the new state.
            for (i = 0; i < activeState.animations.length; i++) {
                clip = this._animEvaluator.findClip(activeState.animations[i].name);
                if (!clip) {
                    clip = new pc.AnimClip(activeState.animations[i].animTrack, 0, activeState.speed, true, true);
                    clip.name = activeState.animations[i].name;
                    this._animEvaluator.addClip(clip);
                }
                if (transition.time > 0) {
                    clip.blendWeight = 0.0;
                } else {
                    clip.blendWeight = 1.0 / activeState.totalWeight;
                }
                clip.reset();
                if (hasTransitionOffset) {
                    clip.time = activeState.timelineDuration * transition.transitionOffset;
                }
                clip.play();
            }

            // set the time in the new state to 0 or to a value based on transitionOffset if one was given
            var timeInState = 0;
            var timeInStateBefore = 0;
            if (hasTransitionOffset) {
                var offsetTime = activeState.timelineDuration * transition.transitionOffset;
                timeInState = offsetTime;
                timeInStateBefore = offsetTime;
            }
            this._timeInState = timeInState;
            this._timeInStateBefore = timeInStateBefore;
        },

        _transitionToState: function (newStateName) {
            if (newStateName === this._activeStateName) {
                return;
            }

            if (!this._findState(newStateName)) {
                return;
            }

            // move to the given state, if a transition is present in the state graph use it. Otherwise move instantly to it.
            var transition = this._findTransition(this._activeStateName, newStateName);
            if (!transition) {
                this._animEvaluator.removeClips();
                transition = new AnimTransition(this, null, newStateName, 0, 0);
            }
            this._updateStateFromTransition(transition);
        },

        assignAnimation: function (stateName, animTrack) {
            var state = this._findState(stateName);
            if (!state) {
                // #ifdef DEBUG
                console.error('Attempting to assign an animation track to an animation state that does not exist.');
                // #endif
                return;
            }

            var animation = {
                name: stateName + '.' + animTrack.name,
                animTrack: animTrack,
                weight: 1.0
            };

            // Currently the anim controller only supports single animations in a state
            if (state.animations.length > 0) {
                state.animations = [];
                this.reset();
            }
            state.animations.push(animation);

            if (!this._playing && this._activate && this.playable) {
                this.play();
            }
        },

        removeNodeAnimations: function (nodeName) {
            var state = this._findState(nodeName);
            if (!state) {
                // #ifdef DEBUG
                console.error('Attempting to unassign animation tracks from a state that does not exist.');
                // #endif
                return;
            }

            state.animations = [];
        },

        play: function (stateName) {
            if (stateName) {
                this._transitionToState(stateName);
            }
            this._playing = true;
        },

        pause: function () {
            this._playing = false;
        },

        reset: function () {
            this._previousStateName = null;
            this._activeStateName = pc.ANIM_STATE_START;
            this._playing = false;
            this._currTransitionTime = 1.0;
            this._totalTransitionTime = 1.0;
            this._isTransitioning = false;
            this._timeInState = 0;
            this._timeInStateBefore = 0;
            this._animEvaluator.removeClips();
        },

        update: function (dt) {
            if (!this._playing) {
                return;
            }
            var i;
            var j;
            var state;
            var animation;
            this._timeInStateBefore = this._timeInState;
            this._timeInState += dt;

            // transition between states if a transition is available from the active state
            var transition = this._findTransition(this._activeStateName);
            if (transition)
                this._updateStateFromTransition(transition);

            if (this._isTransitioning) {
                if (this._currTransitionTime < this._totalTransitionTime) {
                    var interpolatedTime = this._currTransitionTime / this._totalTransitionTime;
                    // while transitioning, set all previous state animations to be weighted by (1.0 - interpolationTime).
                    for (i = 0; i < this._transitionPreviousStates.length; i++) {
                        state = this._findState(this._transitionPreviousStates[i].name);
                        var stateWeight = this._transitionPreviousStates[i].weight;
                        for (j = 0; j < state.animations.length; j++) {
                            animation = state.animations[j];
                            this._animEvaluator.findClip(animation.name + '.previous.' + i).blendWeight = (1.0 - interpolatedTime) * animation.weight / state.totalWeight * stateWeight;
                        }
                    }
                    // while transitioning, set active state animations to be weighted by (interpolationTime).
                    state = this.activeState;
                    for (i = 0; i < state.animations.length; i++) {
                        animation = state.animations[i];
                        this._animEvaluator.findClip(animation.name).blendWeight = interpolatedTime * animation.weight / state.totalWeight;
                    }
                } else {
                    this._isTransitioning = false;
                    // when a transition ends, remove all previous state clips from the evaluator
                    var activeClips = this.activeState.animations.length;
                    var totalClips = this._animEvaluator.clips.length;
                    for (i = 0; i < totalClips - activeClips; i++) {
                        this._animEvaluator.removeClip(0);
                    }
                    this._transitionPreviousStates = [];
                    // when a transition ends, set the active state clip weights so they sum to 1
                    state = this.activeState;
                    for (i = 0; i < state.animations.length; i++) {
                        animation = state.animations[i];
                        this._animEvaluator.findClip(animation.name).blendWeight = animation.weight / state.totalWeight;
                    }
                }
                this._currTransitionTime += dt;
            }
            this._animEvaluator.update(dt);
        },

        findParameter: function (name) {
            return this._parameters[name];
        }
    });

    return {
        AnimController: AnimController
    };
}());
