Object.assign(pc, function () {

    var ANIM_INTERRUPTION_SOURCE_NONE = 'NONE';
    var ANIM_INTERRUPTION_SOURCE_PREV_STATE = 'PREV_STATE';
    var ANIM_INTERRUPTION_SOURCE_NEXT_STATE = 'NEXT_STATE';
    var ANIM_INTERRUPTION_SOURCE_PREV_STATE_NEXT_STATE = 'PREV_STATE_NEXT_STATE';
    var ANIM_INTERRUPTION_SOURCE_NEXT_STATE_PREV_STATE = 'NEXT_STATE_PREV_STATE';

    var ANIM_TRANSITION_PREDICATE_GREATER_THAN = 'GREATER_THAN';
    var ANIM_TRANSITION_PREDICATE_LESS_THAN = 'LESS_THAN';
    var ANIM_TRANSITION_PREDICATE_GREATER_THAN_EQUAL_TO = 'GREATER_THAN_EQUAL_TO';
    var ANIM_TRANSITION_PREDICATE_LESS_THAN_EQUAL_TO = 'LESS_THAN_EQUAL_TO';
    var ANIM_TRANSITION_PREDICATE_EQUAL_TO = 'EQUAL_TO';
    var ANIM_TRANSITION_PREDICATE_NOT_EQUAL_TO = 'NOT_EQUAL_TO';

    var ANIM_PARAMETER_INTEGER = 0;
    var ANIM_PARAMETER_FLOAT = 1;
    var ANIM_PARAMETER_BOOLEAN = 2;
    var ANIM_PARAMETER_TRIGGER = 3;

    var ANIM_PARAMETER_TYPE_NAMES = {
        ANIM_PARAMETER_INTEGER: 'Integer',
        ANIM_PARAMETER_FLOAT: 'Float',
        ANIM_PARAMETER_BOOLEAN: 'Boolean',
        ANIM_PARAMETER_TRIGGER: 'Trigger'
    };

    var ANIM_STATE_START = 'ANIM_STATE_START';
    var ANIM_STATE_END = 'ANIM_STATE_END';

    var AnimState = function (name, speed) {
        this.name = name;
        this.animations = [];
        this.speed = speed || 1.0;
    };

    Object.assign(AnimState.prototype, {
        isPlayable: function () {
            return (this.animations.length > 0 || this.name === ANIM_STATE_START || this.name === ANIM_STATE_END);
        },

        isLooping: function () {
            return true;
        },

        getTotalWeight: function () {
            var sum = 0;
            var i;
            for (i = 0; i < this.animations.length; i++) {
                sum += this.animations[i].weight;
            }
            return sum;
        },

        getTimelineDuration: function () {
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
    });

    var AnimTransition = function (controller, from, to, time, priority, conditions, exitTime, transitionOffset, interruptionSource) {
        this.controller = controller;
        this.from = from;
        this.to = to;
        this.time = time;
        this.priority = priority;
        this.conditions = conditions || [];
        this.exitTime = exitTime || null;
        this.transitionOffset = transitionOffset || null;
        this.interruptionSource = interruptionSource || ANIM_INTERRUPTION_SOURCE_NONE;
    };

    Object.assign(AnimTransition.prototype, {
        hasConditionsMet: function () {
            var conditionsMet = true;
            var i;
            for (i = 0; i < this.conditions.length; i++) {
                var condition = this.conditions[i];
                var parameter = this.controller._getParameter(condition.parameterName);
                switch (condition.predicate) {
                    case ANIM_TRANSITION_PREDICATE_GREATER_THAN:
                        conditionsMet = conditionsMet && parameter.value > condition.value;
                        break;
                    case ANIM_TRANSITION_PREDICATE_LESS_THAN:
                        conditionsMet = conditionsMet && parameter.value < condition.value;
                        break;
                    case ANIM_TRANSITION_PREDICATE_GREATER_THAN_EQUAL_TO:
                        conditionsMet = conditionsMet && parameter.value >= condition.value;
                        break;
                    case ANIM_TRANSITION_PREDICATE_LESS_THAN_EQUAL_TO:
                        conditionsMet = conditionsMet && parameter.value <= condition.value;
                        break;
                    case ANIM_TRANSITION_PREDICATE_EQUAL_TO:
                        conditionsMet = conditionsMet && parameter.value === condition.value;
                        break;
                    case ANIM_TRANSITION_PREDICATE_NOT_EQUAL_TO:
                        conditionsMet = conditionsMet && parameter.value !== condition.value;
                        break;
                }
                if (!conditionsMet)
                    return conditionsMet;
            }
            return conditionsMet;
        },
        hasExitTime: function () {
            return !!this.exitTime;
        }
    });

    var AnimController = function (animEvaluator, states, transitions, parameters, activate) {
        this.animEvaluator = animEvaluator;
        this.states = {};
        var i;
        for (i = 0; i < states.length; i++) {
            this.states[states[i].name] = new AnimState(
                states[i].name,
                states[i].speed
            );
        }
        this.transitions = transitions.map(function (transition) {
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
        this.findTransitionsFromStateCache = {};
        this.findTransitionsBetweenStatesCache = {};
        this.parameters = parameters;
        this.initialParameters = Object.assign({}, parameters);
        this.previousStateName = null;
        this.activeStateName = ANIM_STATE_START;
        this.playing = false;
        this.activate = activate;

        this.currTransitionTime = 1.0;
        this.totalTransitionTime = 1.0;
        this.isTransitioning = false;
        this.transitionInterruptionSource = ANIM_INTERRUPTION_SOURCE_NONE;
        this.transitionPreviousStates = [];

        this.timeInState = 0;
        this.timeInStateBefore = 0;
    };

    Object.assign(AnimController.prototype, {
        _getState: function (stateName) {
            return this.states[stateName];
        },

        _setState: function (stateName, state) {
            this.states[stateName] = state;
        },

        _getActiveState: function () {
            return this._getState(this.activeStateName);
        },

        _setActiveState: function (stateName) {
            this.activeStateName = stateName;
        },

        _getPreviousState: function () {
            return this._getState(this.previousStateName);
        },

        _setPreviousState: function (stateName) {
            this.previousStateName = stateName;
        },

        _findTransitionsFromState: function (stateName) {
            var transitions = this.findTransitionsFromStateCache[stateName];
            if (!transitions) {
                transitions = this.transitions.filter(function (transition) {
                    return transition.from === stateName;
                });

                // sort transitions in priority order
                transitions.sort(function (a, b) {
                    return a.priority < b.priority;
                });

                this.findTransitionsFromStateCache[stateName] = transitions;
            }
            return transitions;
        },

        _findTransitionsBetweenStates: function (sourceStateName, destinationStateName) {
            var transitions = this.findTransitionsBetweenStatesCache[sourceStateName + '->' + destinationStateName];
            if (!transitions) {
                transitions = this.transitions.filter(function (transition) {
                    return transition.from === sourceStateName && transition.to === destinationStateName;
                });

                // sort transitions in priority order
                transitions.sort(function (a, b) {
                    return a.priority < b.priority;
                });

                this.findTransitionsBetweenStatesCache[sourceStateName + '->' + destinationStateName] = transitions;
            }

            return transitions;
        },

        _findTransition: function (from, to) {
            var transitions = [];

            // find transitions that include the required source and destination states
            if (from && to) {
                transitions.concat(this._findTransitionsBetweenStates(this.activeStateName));
            } else {
                if (!this.isTransitioning) {
                    transitions = transitions.concat(this._findTransitionsFromState(this.activeStateName));
                } else {
                    switch (this.transitionInterruptionSource) {
                        case ANIM_INTERRUPTION_SOURCE_PREV_STATE:
                            transitions = transitions.concat(this._findTransitionsFromState(this.previousStateName));
                            break;
                        case ANIM_INTERRUPTION_SOURCE_NEXT_STATE:
                            transitions = transitions.concat(this._findTransitionsFromState(this.activeStateName));
                            break;
                        case ANIM_INTERRUPTION_SOURCE_PREV_STATE_NEXT_STATE:
                            transitions = transitions.concat(this._findTransitionsFromState(this.previousStateName));
                            transitions = transitions.concat(this._findTransitionsFromState(this.activeStateName));
                            break;
                        case ANIM_INTERRUPTION_SOURCE_NEXT_STATE_PREV_STATE:
                            transitions = transitions.concat(this._findTransitionsFromState(this.activeStateName));
                            transitions = transitions.concat(this._findTransitionsFromState(this.previousStateName));
                            break;
                        case ANIM_INTERRUPTION_SOURCE_NONE:
                        default:
                    }
                }
            }

            // filter out transitions that don't have their conditions met
            transitions = transitions.filter(function (transition) {
                // when an exit time is present, we should only exit if it falls within the current frame delta time
                if (transition.hasExitTime()) {
                    var progressBefore = this.getActiveStateProgress(true);
                    var progress = this.getActiveStateProgress();
                    // when the exit time is smaller than 1 and the state is looping, we should check for an exit each loop
                    if (transition.exitTime < 1.0 && this._getActiveState().isLooping()) {
                        progressBefore -= Math.floor(progressBefore);
                        progress -= Math.floor(progress);
                    }
                    // return false if exit time isn't within the frames delta time
                    if (!(transition.exitTime > progressBefore && transition.exitTime <= progress)) {
                        return null;
                    }
                }
                return transition.hasConditionsMet();
            }.bind(this));

            if (transitions.length > 0) {
                return transitions[0];
            }
            return null;

        },

        _updateStateFromTransition: function (transition) {
            var i;
            var j;
            this._setPreviousState(this.activeStateName);
            this._setActiveState(transition.to);

            var triggers = transition.conditions.filter(function (condition) {
                var parameter = this._getParameter(condition.parameterName);
                return parameter.type === ANIM_PARAMETER_TRIGGER;
            }.bind(this));
            for (i = 0; i < triggers.length; i++) {
                this.setParameterValue(triggers[i].parameterName, ANIM_PARAMETER_TRIGGER, false);
            }

            if (this.isTransitioning) {
                var interpolatedTime = this.currTransitionTime / this.totalTransitionTime;
                for (i = 0; i < this.transitionPreviousStates.length; i++) {
                    this.transitionPreviousStates[i].weight *= (1.0 - interpolatedTime);
                    var state = this._getState(this.transitionPreviousStates[i].name);
                    for (j = 0; j < state.animations.length; j++) {
                        var animation = state.animations[j];
                        this.animEvaluator.findClip(animation.name).pause();
                    }
                }
                this.transitionPreviousStates.push({
                    name: this.previousStateName,
                    weight: interpolatedTime
                });
            } else {
                this.transitionPreviousStates.push({
                    name: this.previousStateName,
                    weight: 1.0
                });
            }

            if (transition.time > 0) {
                this.isTransitioning = true;
                this.totalTransitionTime = transition.time;
                this.currTransitionTime = 0;
                this.transitionInterruptionSource = transition.interruptionSource;
            }

            var hasTransitionOffset = transition.transitionOffset && transition.transitionOffset > 0.0 && transition.transitionOffset < 1.0;

            var activeState = this._getActiveState();
            for (i = 0; i < activeState.animations.length; i++) {
                var clip = this.animEvaluator.findClip(activeState.animations[i].name);
                if (!clip) {
                    clip = new pc.AnimClip(activeState.animations[i].animTrack, 0, activeState.speed, true, true);
                    clip.name = activeState.animations[i].name;
                    this.animEvaluator.addClip(clip);
                }
                if (transition.time > 0) {
                    clip.blendWeight = 0.0 / activeState.getTotalWeight();
                } else {
                    clip.blendWeight = 1.0 / activeState.getTotalWeight();
                }
                clip.reset();
                if (hasTransitionOffset) {
                    clip.time = activeState.getTimelineDuration() * transition.transitionOffset;
                }
                clip.play();
            }

            var timeInState = 0;
            var timeInStateBefore = 0;
            if (hasTransitionOffset) {
                var offsetTime = activeState.getTimelineDuration() * transition.transitionOffset;
                timeInState = offsetTime;
                timeInStateBefore = offsetTime;
            }
            this.timeInState = timeInState;
            this.timeInStateBefore = timeInStateBefore;
        },

        _transitionToState: function (newStateName) {
            if (newStateName === this.activeStateName) {
                return;
            }

            if (!this._getState(newStateName)) {
                return;
            }

            var transition = this._findTransition(this.activeStateName, newStateName);
            if (!transition) {
                this.animEvaluator.removeClips();
                transition = new AnimTransition(this, this.activeStateName, newStateName, 0, 0);
            }
            this._updateStateFromTransition(transition);
        },

        assignAnimation: function (stateName, animTrack) {
            var state = this._getState(stateName);
            if (!state) {
                // #ifdef DEBUG
                console.error('Linking animation asset to animation state that does not exist');
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

            if (!this.playing && this.activate && this.isPlayable()) {
                this.play();

            }
        },

        isPlayable: function () {
            var playable = true;
            var i;
            for (i = 0; i < this.states.length; i++) {
                if (!this.states[i].isPlayable()) {
                    playable = false;
                }
            }
            return playable;
        },

        play: function (stateName) {
            if (stateName) {
                this._transitionToState(stateName);
            }
            this.playing = true;
        },

        pause: function () {
            this.playing = false;
        },

        reset: function () {
            this.previousStateName = null;
            this.activeStateName = ANIM_STATE_START;
            this.playing = false;

            this.currTransitionTime = 1.0;
            this.totalTransitionTime = 1.0;
            this.isTransitioning = false;

            this.timeInState = 0;
            this.timeInStateBefore = 0;

            this.animEvaluator.removeClips();

            this.parameters = Object.assign({}, this.initialParameters);
        },

        update: function (dt) {
            if (this.playing) {
                var i;
                var j;
                var state;
                var animation;
                this.timeInStateBefore = this.timeInState;
                this.timeInState += dt;

                var transition = this._findTransition(this.activeStateName);
                if (transition)
                    this._updateStateFromTransition(transition);

                if (this.isTransitioning) {
                    if (this.currTransitionTime >= this.totalTransitionTime) {
                        this.isTransitioning = false;

                        for (i = 0; i < this.transitionPreviousStates.length; i++) {
                            state = this._getState(this.transitionPreviousStates[i].name);
                            for (j = 0; j < state.animations.length; j++) {
                                animation = state.animations[j];
                                var clip = this.animEvaluator.findClip(animation.name);
                                clip.pause();
                                clip.blendWeight = 0;
                            }
                        }

                        this.transitionPreviousStates = [];

                        state = this._getActiveState();
                        for (i = 0; i < state.animations.length; i++) {
                            animation = state.animations[i];
                            this.animEvaluator.findClip(animation.name).blendWeight = animation.weight / state.getTotalWeight();
                        }
                    } else {
                        var interpolatedTime = this.currTransitionTime / this.totalTransitionTime;

                        for (i = 0; i < this.transitionPreviousStates.length; i++) {
                            state = this._getState(this.transitionPreviousStates[i].name);
                            var stateWeight = this.transitionPreviousStates[i].weight;
                            for (j = 0; j < state.animations.length; j++) {
                                animation = state.animations[j];
                                this.animEvaluator.findClip(animation.name).blendWeight = (1.0 - interpolatedTime) * animation.weight / state.getTotalWeight() * stateWeight;
                            }
                        }
                        state = this._getActiveState();
                        for (i = 0; i < state.animations.length; i++) {
                            animation = state.animations[i];
                            this.animEvaluator.findClip(animation.name).blendWeight = interpolatedTime * animation.weight / state.getTotalWeight();
                        }

                    }
                    this.currTransitionTime += dt;
                }
                this.animEvaluator.update(dt);
            }
        },

        getActiveStateProgress: function (checkBeforeUpdate) {
            if (this.activeStateName === ANIM_STATE_START || this.activeStateName === ANIM_STATE_END)
                return 1.0;

            var activeClip = this.animEvaluator.findClip(this._getActiveState().animations[0].name);
            if (activeClip) {
                return (checkBeforeUpdate ? this.timeInStateBefore : this.timeInState) / activeClip.track.duration;
            }

            return null;
        },

        getActiveStateName: function () {
            return this._getState(this.activeStateName).name;
        },

        _getParameter: function (name) {
            return this.parameters[name];
        },

        getParameterValue: function (name, type) {
            var param = this._getParameter(name);
            if (param && param.type === type) {
                return param.value;
            }
            // #ifdef DEBUG
            console.log('Cannot get parameter value. No parameter found in anim controller named "' + name + '" of type "' + ANIM_PARAMETER_TYPE_NAMES[type] + '"');
            // #endif
        },

        setParameterValue: function (name, type, value) {
            var param = this._getParameter(name);
            if (param && param.type === type) {
                param.value = value;
                return;
            }
            // #ifdef DEBUG
            console.log('Cannot set parameter value. No parameter found in anim controller named "' + name + '" of type "' + ANIM_PARAMETER_TYPE_NAMES[type] + '"');
            // #endif
        }
    });

    return {
        ANIM_INTERRUPTION_SOURCE_NONE: ANIM_INTERRUPTION_SOURCE_NONE,
        ANIM_INTERRUPTION_SOURCE_PREV_STATE: ANIM_INTERRUPTION_SOURCE_PREV_STATE,
        ANIM_INTERRUPTION_SOURCE_NEXT_STATE: ANIM_INTERRUPTION_SOURCE_NEXT_STATE,
        ANIM_INTERRUPTION_SOURCE_PREV_STATE_NEXT_STATE: ANIM_INTERRUPTION_SOURCE_PREV_STATE_NEXT_STATE,
        ANIM_INTERRUPTION_SOURCE_NEXT_STATE_PREV_STATE: ANIM_INTERRUPTION_SOURCE_NEXT_STATE_PREV_STATE,

        ANIM_TRANSITION_PREDICATE_GREATER_THAN: ANIM_TRANSITION_PREDICATE_GREATER_THAN,
        ANIM_TRANSITION_PREDICATE_LESS_THAN: ANIM_TRANSITION_PREDICATE_LESS_THAN,
        ANIM_TRANSITION_PREDICATE_GREATER_THAN_EQUAL_TO: ANIM_TRANSITION_PREDICATE_GREATER_THAN_EQUAL_TO,
        ANIM_TRANSITION_PREDICATE_LESS_THAN_EQUAL_TO: ANIM_TRANSITION_PREDICATE_LESS_THAN_EQUAL_TO,
        ANIM_TRANSITION_PREDICATE_EQUAL_TO: ANIM_TRANSITION_PREDICATE_EQUAL_TO,
        ANIM_TRANSITION_PREDICATE_NOT_EQUAL_TO: ANIM_TRANSITION_PREDICATE_NOT_EQUAL_TO,

        ANIM_PARAMETER_TYPE_NAMES: ANIM_PARAMETER_TYPE_NAMES,
        ANIM_PARAMETER_INTEGER: ANIM_PARAMETER_INTEGER,
        ANIM_PARAMETER_FLOAT: ANIM_PARAMETER_FLOAT,
        ANIM_PARAMETER_BOOLEAN: ANIM_PARAMETER_BOOLEAN,
        ANIM_PARAMETER_TRIGGER: ANIM_PARAMETER_TRIGGER,

        ANIM_STATE_START: ANIM_STATE_START,
        ANIM_STATE_END: ANIM_STATE_END,

        AnimController: AnimController
    };
}());
