Object.assign(pc, function () {

    var ANIM_INTERRUPTION_NONE = 'NONE';
    var ANIM_INTERRUPTION_PREV = 'PREV_STATE';
    var ANIM_INTERRUPTION_NEXT = 'NEXT_STATE';
    var ANIM_INTERRUPTION_PREV_NEXT = 'PREV_STATE_NEXT_STATE';
    var ANIM_INTERRUPTION_NEXT_PREV = 'NEXT_STATE_PREV_STATE';

    var ANIM_GREATER_THAN = 'GREATER_THAN';
    var ANIM_LESS_THAN = 'LESS_THAN';
    var ANIM_GREATER_THAN_EQUAL_TO = 'GREATER_THAN_EQUAL_TO';
    var ANIM_LESS_THAN_EQUAL_TO = 'LESS_THAN_EQUAL_TO';
    var ANIM_EQUAL_TO = 'EQUAL_TO';
    var ANIM_NOT_EQUAL_TO = 'NOT_EQUAL_TO';

    var ANIM_PARAMETER_INTEGER = 'INTEGER';
    var ANIM_PARAMETER_FLOAT = 'FLOAT';
    var ANIM_PARAMETER_BOOLEAN = 'BOOLEAN';
    var ANIM_PARAMETER_TRIGGER = 'TRIGGER';

    var ANIM_STATE_START = 'START';
    var ANIM_STATE_END = 'END';

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
                return (this.animations.length > 0 || this.name === ANIM_STATE_START || this.name === ANIM_STATE_END);
            }
        },
        looping: {
            get: function () {
                var trackClipName = this.name + '.' + this.animations[0].animTrack.name;
                var trackClip = this._controller.animEvaluator.findClip(trackClipName);
                if (trackClip) {
                    return trackClip.loop;
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
        this._interruptionSource = interruptionSource || ANIM_INTERRUPTION_NONE;
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
    });

    var AnimController = function (animEvaluator, states, transitions, parameters, activate) {
        this._animEvaluator = animEvaluator;
        this._states = {};
        var i;
        for (i = 0; i < states.length; i++) {
            this._states[states[i].name] = new AnimState(
                this,
                states[i].name,
                states[i].speed
            );
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
        this._initialParameters = Object.assign({}, parameters);
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
                for (i = 0; i < this._states.length; i++) {
                    if (!this._states[i].playable) {
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
        }
    });

    Object.assign(AnimController.prototype, {

        _findState: function (stateName) {
            return this._states[stateName];
        },

        _getActiveStateProgressForTime: function (time) {
            if (this.activeStateName === ANIM_STATE_START || this.activeStateName === ANIM_STATE_END)
                return 1.0;

            var activeClip = this._animEvaluator.findClip(this.activeState.animations[0].name);
            if (activeClip) {
                return time / activeClip.track.duration;
            }

            return null;
        },

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

            // find transitions that include the required source and destination states
            if (from && to) {
                transitions.concat(this._findTransitionsBetweenStates(this._activeStateName));
            } else {
                if (!this._isTransitioning) {
                    transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                } else {
                    switch (this._transitionInterruptionSource) {
                        case ANIM_INTERRUPTION_PREV:
                            transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
                            break;
                        case ANIM_INTERRUPTION_NEXT:
                            transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                            break;
                        case ANIM_INTERRUPTION_PREV_NEXT:
                            transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
                            transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                            break;
                        case ANIM_INTERRUPTION_NEXT_PREV:
                            transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
                            transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
                            break;
                        case ANIM_INTERRUPTION_NONE:
                        default:
                    }
                }
            }

            // filter out transitions that don't have their conditions met
            transitions = transitions.filter(function (transition) {
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
                return transition.hasConditionsMet;
            }.bind(this));

            if (transitions.length > 0) {
                return transitions[0];
            }
            return null;

        },

        _updateStateFromTransition: function (transition) {
            var i;
            var j;
            this.previousState = this._activeStateName;
            this.activeState = transition.to;

            var triggers = transition.conditions.filter(function (condition) {
                var parameter = this.findParameter(condition.parameterName);
                return parameter.type === ANIM_PARAMETER_TRIGGER;
            }.bind(this));
            for (i = 0; i < triggers.length; i++) {
                this.setParameterValue(triggers[i].parameterName, ANIM_PARAMETER_TRIGGER, false);
            }

            if (this._isTransitioning) {
                var interpolatedTime = this._currTransitionTime / this._totalTransitionTime;
                for (i = 0; i < this._transitionPreviousStates.length; i++) {
                    this._transitionPreviousStates[i].weight *= (1.0 - interpolatedTime);
                    var state = this._findState(this._transitionPreviousStates[i].name);
                    for (j = 0; j < state.animations.length; j++) {
                        var animation = state.animations[j];
                        this._animEvaluator.findClip(animation.name).pause();
                    }
                }
                this._transitionPreviousStates.push({
                    name: this._previousStateName,
                    weight: interpolatedTime
                });
            } else {
                this._transitionPreviousStates.push({
                    name: this._previousStateName,
                    weight: 1.0
                });
            }

            if (transition.time > 0) {
                this._isTransitioning = true;
                this._totalTransitionTime = transition.time;
                this._currTransitionTime = 0;
                this._transitionInterruptionSource = transition.interruptionSource;
            }

            var hasTransitionOffset = transition.transitionOffset && transition.transitionOffset > 0.0 && transition.transitionOffset < 1.0;

            var activeState = this.activeState;
            for (i = 0; i < activeState.animations.length; i++) {
                var clip = this._animEvaluator.findClip(activeState.animations[i].name);
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

            var transition = this._findTransition(this._activeStateName, newStateName);
            if (!transition) {
                this._animEvaluator.removeClips();
                transition = new AnimTransition(this, this._activeStateName, newStateName, 0, 0);
            }
            this._updateStateFromTransition(transition);
        },

        assignAnimation: function (stateName, animTrack) {
            var state = this._findState(stateName);
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

            if (!this._playing && this._activate && this.playable) {
                this.play();
            }
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
            this._activeStateName = ANIM_STATE_START;
            this._playing = false;
            this._currTransitionTime = 1.0;
            this._totalTransitionTime = 1.0;
            this._isTransitioning = false;
            this._timeInState = 0;
            this._timeInStateBefore = 0;
            this._parameters = Object.assign({}, this._initialParameters);
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

            var transition = this._findTransition(this._activeStateName);
            if (transition)
                this._updateStateFromTransition(transition);

            if (this._isTransitioning) {
                if (this._currTransitionTime >= this._totalTransitionTime) {
                    this._isTransitioning = false;

                    for (i = 0; i < this._transitionPreviousStates.length; i++) {
                        state = this._findState(this._transitionPreviousStates[i].name);
                        for (j = 0; j < state.animations.length; j++) {
                            animation = state.animations[j];
                            var clip = this._animEvaluator.findClip(animation.name);
                            clip.pause();
                            clip.blendWeight = 0;
                        }
                    }

                    this._transitionPreviousStates = [];

                    state = this.activeState;
                    for (i = 0; i < state.animations.length; i++) {
                        animation = state.animations[i];
                        this._animEvaluator.findClip(animation.name).blendWeight = animation.weight / state.totalWeight;
                    }
                } else {
                    var interpolatedTime = this._currTransitionTime / this._totalTransitionTime;

                    for (i = 0; i < this._transitionPreviousStates.length; i++) {
                        state = this._findState(this._transitionPreviousStates[i].name);
                        var stateWeight = this._transitionPreviousStates[i].weight;
                        for (j = 0; j < state.animations.length; j++) {
                            animation = state.animations[j];
                            this._animEvaluator.findClip(animation.name).blendWeight = (1.0 - interpolatedTime) * animation.weight / state.totalWeight * stateWeight;
                        }
                    }
                    state = this.activeState;
                    for (i = 0; i < state.animations.length; i++) {
                        animation = state.animations[i];
                        this._animEvaluator.findClip(animation.name).blendWeight = interpolatedTime * animation.weight / state.totalWeight;
                    }

                }
                this._currTransitionTime += dt;
            }
            this._animEvaluator.update(dt);
        },

        findParameter: function (name) {
            return this._parameters[name];
        },

        getParameterValue: function (name, type) {
            var param = this.findParameter(name);
            if (param && param.type === type) {
                return param.value;
            }
            // #ifdef DEBUG
            console.log('Cannot get parameter value. No parameter found in anim controller named "' + name + '" of type "' + type + '"');
            // #endif
        },

        setParameterValue: function (name, type, value) {
            var param = this.findParameter(name);
            if (param && param.type === type) {
                param.value = value;
                return;
            }
            // #ifdef DEBUG
            console.log('Cannot set parameter value. No parameter found in anim controller named "' + name + '" of type "' + type + '"');
            // #endif
        }
    });

    return {
        ANIM_INTERRUPTION_NONE: ANIM_INTERRUPTION_NONE,
        ANIM_INTERRUPTION_PREV: ANIM_INTERRUPTION_PREV,
        ANIM_INTERRUPTION_NEXT: ANIM_INTERRUPTION_NEXT,
        ANIM_INTERRUPTION_PREV_NEXT: ANIM_INTERRUPTION_PREV_NEXT,
        ANIM_INTERRUPTION_NEXT_PREV: ANIM_INTERRUPTION_NEXT_PREV,

        ANIM_GREATER_THAN: ANIM_GREATER_THAN,
        ANIM_LESS_THAN: ANIM_LESS_THAN,
        ANIM_GREATER_THAN_EQUAL_TO: ANIM_GREATER_THAN_EQUAL_TO,
        ANIM_LESS_THAN_EQUAL_TO: ANIM_LESS_THAN_EQUAL_TO,
        ANIM_EQUAL_TO: ANIM_EQUAL_TO,
        ANIM_NOT_EQUAL_TO: ANIM_NOT_EQUAL_TO,

        ANIM_PARAMETER_INTEGER: ANIM_PARAMETER_INTEGER,
        ANIM_PARAMETER_FLOAT: ANIM_PARAMETER_FLOAT,
        ANIM_PARAMETER_BOOLEAN: ANIM_PARAMETER_BOOLEAN,
        ANIM_PARAMETER_TRIGGER: ANIM_PARAMETER_TRIGGER,

        ANIM_STATE_START: ANIM_STATE_START,
        ANIM_STATE_END: ANIM_STATE_END,

        AnimController: AnimController
    };
}());
