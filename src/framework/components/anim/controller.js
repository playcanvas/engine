import { AnimClip } from '../../../anim/anim.js';

import {
    ANIM_GREATER_THAN, ANIM_LESS_THAN, ANIM_GREATER_THAN_EQUAL_TO, ANIM_LESS_THAN_EQUAL_TO, ANIM_EQUAL_TO, ANIM_NOT_EQUAL_TO,
    ANIM_INTERRUPTION_NONE, ANIM_INTERRUPTION_PREV, ANIM_INTERRUPTION_NEXT, ANIM_INTERRUPTION_PREV_NEXT, ANIM_INTERRUPTION_NEXT_PREV,
    ANIM_PARAMETER_TRIGGER,
    ANIM_STATE_START, ANIM_STATE_END, ANIM_STATE_ANY,
    ANIM_BLEND_1D, ANIM_BLEND_2D_DIRECTIONAL, ANIM_BLEND_2D_CARTESIAN, ANIM_BLEND_DIRECT
} from './constants.js';

function AnimNode(parent, name, point, speed) {
    this._parent = parent;
    this._name = name;
    this._point = Array.isArray(point) ? new pc.Vec2(point) : point;
    this._speed = speed || 1.0;
    this._weight = 1.0;
    this._animTrack = null;
}

Object.defineProperties(AnimNode.prototype, {
    parent: {
        get: function () {
            return this._parent;
        }
    },
    name: {
        get: function () {
            return this._name;
        }
    },
    path: {
        get: function () {
            return this._parent ? this._parent.path + '.' + this._name : this._name;
        }
    },
    point: {
        get: function () {
            return this._point;
        }
    },
    weight: {
        get: function () {
            return this._parent ? this._parent.weight * this._weight : this._weight;
        },
        set: function (value) {
            this._weight = value;
        }
    },
    speed: {
        get: function () {
            return this._speed;
        }
    },
    animTrack: {
        get: function () {
            return this._animTrack;
        },
        set: function (value) {
            this._animTrack = value;
        }
    }
});

function BlendTree(parent, name, point, type, parameters, children, findParameter) {
    this._parent = parent;
    this._name = name;
    this._type = type;
    this._parameters = parameters;
    this._point = Array.isArray(point) ? new pc.Vec2(point) : point;
    this._parameterValues = null;
    this._weight = 1.0;
    this._children = [];
    this._findParameter = findParameter;
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.children) {
            this._children.push(new BlendTree(this, child.name, child.point, child.type, child.parameter ? [child.parameter] : child.parameters, child.children, findParameter));
        } else {
            this._children.push(new AnimNode(this, child.name, child.point, child.speed));
        }
    }
}

Object.defineProperties(BlendTree.prototype, {
    parent: {
        get: function () {
            return this._parent;
        }
    },
    name: {
        get: function () {
            return this._name;
        }
    },
    point: {
        get: function () {
            return this._point;
        }
    },
    weight: {
        get: function () {
            this.calculateWeights();
            return this._parent ? this._parent.weight * this._weight : this._weight;
        },
        set: function (value) {
            this._weight = value;
        }
    },
    speed: {
        get: function () {
            return this._speed;
        }
    }
});


// Maths helper functions
function between(num, a, b, inclusive) {
    var min = Math.min(a, b),
        max = Math.max(a, b);
    return inclusive ? num >= min && num <= max : num > min && num < max;
}

function getAngleRad(a, b) {
    return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
}

function clamp(num, min, max) {
    return num <= min ? min : num >= max ? max : num;
}

Object.assign(BlendTree.prototype, AnimNode.prototype, {
    getChild: function (name) {
        for (var i = 0; i < this._children.length; i++) {
            if (this._children[i].name === name) return this._children[i];
        }
    },
    calculateWeights: function () {
        var i, j, p, pi, pj, pip, pipj, parameterValues, minj, result, weightSum;
        switch (this._type) {
            case ANIM_BLEND_1D: {
                var parameterValue = this._findParameter(this._parameters[0]).value;
                if (this._parameterValues && (this._parameterValues[0] === parameterValue)) {
                    return;
                }
                this._parameterValues = [parameterValue];
                this._children[0].weight = 0.0;
                for (i = 0; i < this._children.length - 1; i++) {
                    var child1 = this._children[i];
                    var child2 = this._children[i + 1];
                    if (between(parameterValue, child1.point, child2.point, true)) {
                        var child2Distance = Math.abs(child1.point - child2.point);
                        var parameterDistance = Math.abs(child1.point - parameterValue);
                        var weight = (child2Distance - parameterDistance) / child2Distance;
                        child1.weight = weight;
                        child2.weight = (1.0 - weight);
                    } else {
                        child2.weight = 0.0;
                    }
                }
                break;
            }
            case ANIM_BLEND_2D_CARTESIAN: {
                parameterValues = this._parameters.map(function (param) {
                    return this._findParameter(param).value;
                }.bind(this));
                if (this._parameterValues && (this._parameterValues.equals(parameterValues))) {
                    return;
                }
                this._parameterValues = parameterValues;
                p = new pc.Vec2(this._parameterValues);

                weightSum = 0.0;
                for (i = 0; i < this._children.length; i++) {
                    pi = this._children[i].point.clone();
                    minj = Number.MAX_VALUE;
                    for (j = 0; j < this._children.length; j++) {
                        if (i === j) continue;
                        pj = this._children[j].point.clone();
                        pipj = pj.clone().sub(pi);
                        pip = p.clone().sub(pi);
                        result = clamp(1.0 - (pip.clone().dot(pipj) / pipj.lengthSq()), 0.0, 1.0);
                        if (result < minj) minj = result;
                    }
                    this._children[i].weight = minj;
                    weightSum += minj;
                }
                for (i = 0; i < this._children.length; i++) {
                    this._children[i].weight = this._children[i]._weight / weightSum;
                }
                break;
            }
            case ANIM_BLEND_2D_DIRECTIONAL: {
                parameterValues = this._parameters.map(function (param) {
                    return this._findParameter(param).value;
                }.bind(this));
                if (this._parameterValues && (this._parameterValues.equals(parameterValues))) {
                    return;
                }
                this._parameterValues = parameterValues;
                p = new pc.Vec2(this._parameterValues);


                weightSum = 0.0;
                for (i = 0; i < this._children.length; i++) {
                    pi = this._children[i].point.clone();
                    minj = Number.MAX_VALUE;
                    for (j = 0; j < this._children.length; j++) {
                        if (i === j) continue;
                        pj = this._children[j].point.clone();
                        var pipAngle = getAngleRad(pi, p);
                        var pipjAngle = getAngleRad(pi, pj);
                        pipj = new pc.Vec2((pj.length() - pi.length()) / ((pj.length() + pi.length()) / 2), pipjAngle * 2.0);
                        pip = new pc.Vec2((p.length() - pi.length()) / ((pj.length() + pi.length()) / 2), pipAngle * 2.0);
                        result = clamp(1.0 - Math.abs((pip.clone().dot(pipj) / pipj.lengthSq())), 0.0, 1.0);
                        if (result < minj) minj = result;
                    }
                    this._children[i].weight = minj;
                    weightSum += minj;
                }
                for (i = 0; i < this._children.length; i++) {
                    this._children[i].weight = this._children[i]._weight / weightSum;
                }
                break;
            }
            case ANIM_BLEND_DIRECT: {
                parameterValues = this._parameters.map(function (param) {
                    return this._findParameter(param).value;
                }.bind(this));
                if (this._parameterValues === parameterValues) {
                    return;
                }
                this._parameterValues = parameterValues;
                var sum = this._parameterValues.reduce(function (a, b) {
                    return a + b;
                }, 0);
                for (i = 0; i < this._children.length; i++) {
                    this._children[i].weight = this._parameterValues[i] / sum;
                }
                break;
            }
        }
    },
    getNodeCount: function () {
        var count = 0;
        for (var i = 0; i < this._children.length; i++) {
            var child = this._children[i];
            if (child.constructor === BlendTree) {
                count += this._children[i].getNodeCount();
            } else {
                count++;
            }
        }
        return count;
    }
});


function AnimState(controller, name, speed, loop, blendTree) {
    this._controller = controller;
    this._name = name;
    this._animations = {};
    this._animationList = [];
    this._speed = speed || 1.0;
    this._loop = loop === undefined ? true : loop;
    var findParameter = this._controller.findParameter.bind(this._controller);
    if (blendTree) {
        this._blendTree = new BlendTree(null, name, 1.0, blendTree.type, blendTree.parameter ? [blendTree.parameter] : blendTree.parameters, blendTree.children, findParameter);
    } else {
        this._blendTree = new AnimNode(null, name, 1.0, speed);
    }
}

Object.assign(AnimState.prototype, {
    _getNodeFromPath: function (path) {
        var currNode = this._blendTree;
        for (var i = 1; i < path.length; i++) {
            currNode = currNode.getChild(path[i]);
        }
        return currNode;
    },
    addAnimation: function (path, animTrack) {
        var indexOfAnimation = this._animationList.findIndex(function (animation) {
            return animation.path === path;
        });
        if (indexOfAnimation >= 0) {
            this._animationList[indexOfAnimation].animTrack = animTrack;
        } else {
            var node = this._getNodeFromPath(path);
            node.animTrack = animTrack;
            this._animationList.push(node);
        }
    }
});

Object.defineProperties(AnimState.prototype, {
    name: {
        get: function () {
            return this._name;
        }
    },
    animations: {
        get: function () {
            return this._animationList;
        },
        set: function (value) {
            this._animationList = value;
        }
    },
    speed: {
        get: function () {
            return this._speed;
        }
    },
    loop: {
        get: function () {
            return this._loop;
        }
    },
    nodeCount: {
        get: function () {
            if (!this._blendTree || !(this._blendTree.constructor === BlendTree)) return 1;
            return this._blendTree.getNodeCount();
        }
    },
    playable: {
        get: function () {
            return (this.name === ANIM_STATE_START || this.name === ANIM_STATE_END || this.animations.length === this.nodeCount);
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

function AnimTransition(controller, from, to, time, priority, conditions, exitTime, transitionOffset, interruptionSource) {
    this._controller = controller;
    this._from = from;
    this._to = to;
    this._time = time;
    this._priority = priority;
    this._conditions = conditions || [];
    this._exitTime = exitTime || null;
    this._transitionOffset = transitionOffset || null;
    this._interruptionSource = interruptionSource || ANIM_INTERRUPTION_NONE;
}

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

function AnimController(animEvaluator, states, transitions, parameters, activate) {
    this._animEvaluator = animEvaluator;
    this._states = {};
    this._stateNames = [];
    var i;
    for (i = 0; i < states.length; i++) {
        this._states[states[i].name] = new AnimState(
            this,
            states[i].name,
            states[i].speed,
            states[i].loop,
            states[i].blendTree
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
    activeStateAnimations: {
        get: function () {
            return this.activeState.animations;
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
            for (i = 0; i < this._stateNames.length; i++) {
                if (!this._states[this._stateNames[i]].playable) {
                    playable = false;
                }
            }
            return playable;
        }
    },
    playing: {
        get: function () {
            return this._playing;
        },
        set: function (value) {
            this._playing = value;
        }
    },
    activeStateProgress: {
        get: function () {
            return this._getActiveStateProgressForTime(this._timeInState);
        }
    },
    activeStateDuration: {
        get: function () {
            if (this.activeStateName === ANIM_STATE_START || this.activeStateName === ANIM_STATE_END)
                return 0.0;

            var maxDuration = 0.0;
            for (var i = 0; i < this.activeStateAnimations.length; i++) {
                var activeClip = this._animEvaluator.findClip(this.activeStateAnimations[i].name);
                maxDuration = Math.max(maxDuration, activeClip.track.duration);
            }
            return maxDuration;
        }
    },
    activeStateCurrentTime: {
        get: function () {
            return this._timeInState;
        },
        set: function (time) {
            this._timeInStateBefore = time;
            this._timeInState = time;
            for (var i = 0; i < this.activeStateAnimations.length; i++) {
                var clip = this.animEvaluator.findClip(this.activeStateAnimations[i].name);
                if (clip) {
                    clip.time = time;
                }
            }
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
        if (this.activeStateName === ANIM_STATE_START || this.activeStateName === ANIM_STATE_END)
            return 1.0;

        var activeClip = this._animEvaluator.findClip(this.activeStateAnimations[0].name);
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

        // If from and to is supplied, find transitions that include the required source and destination states
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
            var interpolatedTime = Math.min(this._currTransitionTime / this._totalTransitionTime, 1.0);
            for (i = 0; i < this._transitionPreviousStates.length; i++) {
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
                for (j = 0; j < state.animations.length; j++) {
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
                var speed = activeState.animations[i].speed ? activeState.animations[i].speed : activeState.speed;
                clip = new AnimClip(activeState.animations[i].animTrack, 0, speed, true, activeState.loop);
                clip.name = activeState.animations[i].name;
                this._animEvaluator.addClip(clip);
            } else {
                clip.reset();
            }
            if (transition.time > 0) {
                clip.blendWeight = 0.0;
            } else {
                clip.blendWeight = activeState.animations[i].weight / activeState.totalWeight;
            }
            clip.play();
            if (hasTransitionOffset) {
                clip.time = activeState.timelineDuration * transition.transitionOffset;
            } else {
                var startTime = activeState.speed >= 0 ? 0 : this.activeStateDuration;
                clip.time = startTime;
            }
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

    assignAnimation: function (pathString, animTrack) {
        var path = pathString.split('.');
        var state = this._findState(path[0]);
        if (!state) {
            // #ifdef DEBUG
            console.error('Attempting to assign an animation track to an animation state that does not exist.');
            // #endif
            return;
        }
        state.addAnimation(path, animTrack);

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
        this._activeStateName = ANIM_STATE_START;
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
        var clip;
        this._timeInStateBefore = this._timeInState;
        this._timeInState += dt;

        // transition between states if a transition is available from the active state
        var transition = this._findTransition(this._activeStateName);
        if (transition)
            this._updateStateFromTransition(transition);

        if (this._isTransitioning) {
            this._currTransitionTime += dt;
            if (this._currTransitionTime <= this._totalTransitionTime) {
                var interpolatedTime = this._currTransitionTime / this._totalTransitionTime;
                // while transitioning, set all previous state animations to be weighted by (1.0 - interpolationTime).
                for (i = 0; i < this._transitionPreviousStates.length; i++) {
                    state = this._findState(this._transitionPreviousStates[i].name);
                    var stateWeight = this._transitionPreviousStates[i].weight;
                    for (j = 0; j < state.animations.length; j++) {
                        animation = state.animations[j];
                        clip = this._animEvaluator.findClip(animation.name + '.previous.' + i);
                        if (clip) {
                            clip.blendWeight = (1.0 - interpolatedTime) * animation.weight / state.totalWeight * stateWeight;
                        }
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
                var activeClips = this.activeStateAnimations.length;
                var totalClips = this._animEvaluator.clips.length;
                for (i = 0; i < totalClips - activeClips; i++) {
                    this._animEvaluator.removeClip(0);
                }
                this._transitionPreviousStates = [];
                // when a transition ends, set the active state clip weights so they sum to 1
                state = this.activeState;
                for (i = 0; i < state.animations.length; i++) {
                    animation = state.animations[i];
                    clip = this._animEvaluator.findClip(animation.name);
                    if (clip) {
                        clip.blendWeight = animation.weight / state.totalWeight;
                    }
                }
            }
        } else {
            if (this.activeState._blendTree.constructor === BlendTree) {
                state = this.activeState;
                for (i = 0; i < state.animations.length; i++) {
                    animation = state.animations[i];
                    clip = this._animEvaluator.findClip(animation.name);
                    if (clip) {
                        clip.blendWeight = animation.weight / state.totalWeight;
                    }
                }
            }
        }
        this._animEvaluator.update(dt);
    },

    findParameter: function (name) {
        return this._parameters[name];
    }
});

export { AnimController };
