Object.assign(pc, function () {

    var AnimState = function (name, speed) {
        this.name = name;
        this.animations = [];
        this.speed = speed || 1.0;
    };

    Object.assign(AnimState.prototype, {
        isPlayable: function() {
            return (this.animations.length > 0 || this.name === 'Start' || this.name === 'End');
        },
        isLooping: function() {
            return true;
        },
        getTotalWeight: function() {
            var sum = 0;
            for (var i = 0; i < this.animations.length; i++) {
                sum = sum + this.animations[i].weight;
            }
            return sum;
        }
    });

    var AnimTransition = function (controller, from, to, time, priority, conditions, exitTime) {
        this.controller = controller;
        this.from = from;
        this.to = to;
        this.time = time;
        this.priority = priority;
        this.conditions = conditions || [];
        this.exitTime = exitTime || null;
    };

    Object.assign(AnimTransition.prototype, {
        hasConditionsMet: function() {
            var conditionsMet = true;
            for (var i = 0; i < this.conditions.length; i++) {
                var condition = this.conditions[i];
                var parameter = this.controller.getParameter(condition.parameterName);
                switch(condition.predicate) {
                    case 'GREATER_THAN':
                        conditionsMet = conditionsMet && parameter.value > condition.value;
                        break;
                    case 'LESS_THAN':
                        conditionsMet = conditionsMet && parameter.value < condition.value;
                        break;
                    case 'GREATER_THAN_EQUAL_TO':
                        conditionsMet = conditionsMet && parameter.value >= condition.value;
                        break;
                    case 'LESS_THAN_EQUAL_TO':
                        conditionsMet = conditionsMet && parameter.value <= condition.value;
                        break;
                    case 'EQUAL_TO':
                        conditionsMet = conditionsMet && parameter.value === condition.value;
                        break;
                    case 'NOT_EQUAL_TO':
                        conditionsMet = conditionsMet && parameter.value !== condition.value;
                        break;
                }
                if (!conditionsMet)
                    return conditionsMet;
            }
            return conditionsMet;
        },
        hasExitTime: function() {
            return !!this.exitTime;
        }
    });

    var AnimController = function (animEvaluator, states, transitions, parameters, activate) {
        this.animEvaluator = animEvaluator;
        this.states = states.map(function(state) {
            return new AnimState(state.name, state.speed);
        });
        this.transitions = transitions.map((function(transition) {
            return new AnimTransition(this, transition.from, transition.to, transition.time, transition.priority, transition.conditions, transition.exitTime);
        }).bind(this));
        this.parameters = parameters;
        this.previousStateName = null;
        this.activeStateName = 'Start';
        this.playing = false;
        this.activate = activate;
        
        this.currTransitionTime = 1.0;
        this.totalTransitionTime = 1.0;
        this.isTransitioning = false;

        this.timeInState = 0;
        this.timeInStateBefore = 0;
    };

    Object.assign(AnimController.prototype, {
        _getState: function(stateName) {
            for (var i = 0; i < this.states.length; i++) {
                if (this.states[i].name === stateName) {
                    return this.states[i];
                }
            }
            return null;
        },

        _setState: function(stateName, state) {
            for (var i = 0; i < this.states.length; i++) {
                if (this.states[i].name === stateName) {
                    this.states[i] = state;
                }
            }
        },

        _getActiveState: function() {
            return this._getState(this.activeStateName);
        },

        _setActiveState: function(stateName) {
            return this.activeStateName = stateName;
        },

        _getPreviousState: function() {
            return this._getState(this.previousStateName);
        },

        _setPreviousState: function(stateName) {
            return this.previousStateName = stateName;
        },

        _getActiveStateProgress: function(checkBeforeUpdate) {
            if (this.activeStateName === 'Start' || this.activeStateName === 'End')
                return 1.0;
            else {
                var activeClip = this.animEvaluator.findClip(this._getActiveState().animations[0].name);
                if (activeClip) {
                    return (checkBeforeUpdate ? this.timeInStateBefore : this.timeInState) / activeClip.track.duration;
                }
            }
            return null;
        },

        _findTransition: function(from, to) {
            if (this.isTransitioning) {
                return false;
            }
            var transitions = this.transitions.filter((function(transition) {
                if (to && from) {
                    return transition.from === from && transition.to === to;
                } else {
                    return transition.from === this.activeStateName;
                }
            }).bind(this));
            transitions = transitions.filter((function(transition) {
                // when an exit time is present, we should only exit if it falls within the current frame delta time
                if (transition.hasExitTime()) {
                    var progressBefore = this._getActiveStateProgress(true);
                    var progress = this._getActiveStateProgress();
                    // when the exit time is smaller than 1 and the state is looping, we should check for an exit each loop
                    if (transition.exitTime < 1.0 && this._getActiveState().isLooping()) {
                        progressBefore = progressBefore - Math.floor(progressBefore);
                        progress = progress - Math.floor(progress);
                    }
                    // return false if exit time isn't within the frames delta time
                    if (!(transition.exitTime > progressBefore && transition.exitTime <= progress)) {
                        return false;
                    }
                }
                return transition.hasConditionsMet();
            }).bind(this));
            transitions.sort(function(a, b) {
                return a.priority < b.priority;
            });
            if (transitions.length > 0) {
                return transitions[0];
            } else {
                return null;
            }
        },

        _updateStateFromTransition: function(transition) {
            this._setPreviousState(this.activeStateName);
            this._setActiveState(transition.to);

            var triggers = transition.conditions.filter((function(condition) {
                var parameter = this.getParameter(condition.parameterName);
                return parameter.type === 'trigger';
            }).bind(this));
            for (var i = 0; i < triggers.length; i++) {
                this.resetTrigger(triggers[i].parameterName);
            }

            if (transition.time > 0) {
                this.isTransitioning = true;
                this.totalTransitionTime = transition.time;
                this.currTransitionTime = 0;
            }
            this.timeInState = 0;
            this.timeInStateBefore = 0;

            var activeState = this._getActiveState();
            for (var i = 0; i < activeState.animations.length; i++) {
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
                clip.play();
            }
        },

        _transitionToState: function(newStateName) {
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

        _transitionToNextState: function() {
            var transition = this._findTransition();
            if (!transition) {
                return;
            }
            if (transition.to === 'End')
            {
                this._setActiveState('Start');
                transition = this._findTransition();
            }
            this._updateStateFromTransition(transition);
        },

        linkAnimationToState: function(stateName, animTrack) {
            var state = this._getState(stateName);
            if (!state) {
                console.error('Linking animation asset to animation state that does not exist');
                return;
            }

            var animation = {
                name: animTrack.name,
                animTrack: animTrack,
                weight: 1.0
            };
            state.animations.push(animation);

            if (!this.playing && this.activate && this.isPlayable()) {
                this.play();
            }
        },

        isPlayable: function() {
            var playable = true;
            for (var i = 0; i < this.states.length; i++) {
                if (!this.states[i].isPlayable()) {
                    playable = false;
                }
            }
            return playable;
        },

        play: function(stateName) {
            if (stateName) {
                this._transitionToState(stateName);
            }
            this.playing = true;
        },
        
        update: function(dt) {
            if (this.playing) {
                this.animEvaluator.update(dt);
                this.timeInStateBefore = this.timeInState;
                this.timeInState = this.timeInState + dt;

                var transition = this._findTransition(this.activeStateName);
                if (transition)
                    this._updateStateFromTransition(transition);

                if (this.isTransitioning) {
                    if (this.currTransitionTime >= this.totalTransitionTime) {
                        this.isTransitioning = false;

                        var previousState = this._getPreviousState();
                        for (var i = 0; i < previousState.animations.length; i++) {
                            var animation = previousState.animations[i];
                            this.animEvaluator.findClip(animation.name).pause();
                            this.animEvaluator.findClip(animation.name).blendWeight = 0;
                        }

                        var activeState = this._getActiveState();
                        for (var i = 0; i < activeState.animations.length; i++) {
                            var animation = activeState.animations[i];
                            this.animEvaluator.findClip(animation.name).blendWeight = animation.weight / activeState.getTotalWeight();
                        }
                    } else {
                        var interpolatedTime = this.currTransitionTime / this.totalTransitionTime;

                        var previousState = this._getPreviousState();
                        for (var i = 0; i < previousState.animations.length; i++) {
                            var animation = previousState.animations[i];
                            this.animEvaluator.findClip(animation.name).blendWeight = (1.0 - interpolatedTime) * animation.weight / previousState.getTotalWeight();
                        }
                        var activeState = this._getActiveState();
                        for (var i = 0; i < activeState.animations.length; i++) {
                            var animation = activeState.animations[i];
                            this.animEvaluator.findClip(animation.name).blendWeight = interpolatedTime * animation.weight / activeState.getTotalWeight();
                        }

                    }
                    this.currTransitionTime = this.currTransitionTime + dt;
                }
            }
        },

        getFloat: function(name) {
            return this.parameters[name].value;
        },

        setFloat: function(name, value) {
            //TODO typechecking
            var float = this.parameters[name];
            if (float && float.type === 'float')
                float.value = value;
        },

        getInteger: function(name) {
            return this.parameters[name].value;
        },

        setInteger: function(name, value) {
            //TODO typechecking
            var integer = this.parameters[name];
            if (integer && integer.type === 'integer')
                integer.value = value;
        },

        getBoolean: function(name) {
            return this.parameters[name].value;
        },

        setBoolean: function(name, value) {
            //TODO typechecking
            var boolean = this.parameters[name];
            if (boolean && boolean.type === 'boolean')
                boolean.value = value;
        },

        getTrigger: function(name) {
            return this.parameters[name].value;
        },

        setTrigger: function(name) {
            //TODO typechecking
            var trigger = this.parameters[name];
            if (trigger && trigger.type === 'trigger')
                trigger.value = true;
        },

        resetTrigger: function(name) {
            //TODO typechecking
            var trigger = this.parameters[name];
            if (trigger && trigger.type === 'trigger')
                trigger.value = false;
        },

        getParameter: function(name) {
            return this.parameters[name];
        }
    });

    return {
        AnimController: AnimController
    }
}());