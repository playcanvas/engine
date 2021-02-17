import { Vec2 } from '../../math/vec2.js';

import { AnimNode } from './anim-node.js';
import {
    ANIM_BLEND_1D, ANIM_BLEND_2D_DIRECTIONAL, ANIM_BLEND_2D_CARTESIAN, ANIM_BLEND_DIRECT
} from './constants.js';

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

/**
 * @private
 * @class
 * @name AnimBlendTree
 * @classdesc BlendTrees are used to store and blend multiple AnimNodes together. BlendTrees can be the child of other AnimBlendTrees, in order to create a hierarchy of AnimNodes. It takes a blend type as an argument which defines which function should be used to determine the weights of each of it's children, based on the current parameter value.
 * @description Create a new BlendTree.
 * @param {AnimState} state - The AnimState that this AnimBlendTree belongs to.
 * @param {AnimBlendTree|null} parent - The parent of the AnimBlendTree. If not null, the AnimNode is stored as part of a {@link AnimBlendTree} hierarchy.
 * @param {string} name - The name of the BlendTree. Used when assigning a {@link AnimTrack} to its children.
 * @param {number|Vec2} point - The coordinate/vector thats used to determine the weight of this node when it's part of a {@link AnimBlendTree}.
 * @param {string} type - Determines which blending algorithm is used to calculate the weights of its child nodes. One of ANIM_BLEND_*.
 * @param {string[]} parameters - The anim component parameters which are used to calculate the current weights of the blend trees children.
 * @param {object[]} children - The child nodes that this blend tree should create. Can either be of type {@link AnimNode} or {@link BlendTree}.
 * @param {Function} findParameter - Used at runtime to get the current parameter values.
 */
class AnimBlendTree extends AnimNode {
    constructor(state, parent, name, point, type, parameters, children, findParameter) {
        super(state, parent, name, point);
        this._type = type;
        this._parameters = parameters;
        this._parameterValues = null;
        this._children = [];
        this._findParameter = findParameter;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child.children) {
                this._children.push(new AnimBlendTree(state, this, child.name, child.point, child.type, child.parameter ? [child.parameter] : child.parameters, child.children, findParameter));
            } else {
                this._children.push(new AnimNode(state, this, child.name, child.point, child.speed));
            }
        }
    }

    get parent() {
        return this._parent;
    }

    get name() {
        return this._name;
    }

    get point() {
        return this._point;
    }

    get weight() {
        this.calculateWeights();
        return this._parent ? this._parent.weight * this._weight : this._weight;
    }

    set weight(value) {
        this._weight = value;
    }

    get speed() {
        return this._speed;
    }

    getChild(name) {
        for (var i = 0; i < this._children.length; i++) {
            if (this._children[i].name === name) return this._children[i];
        }
    }

    calculateWeights() {
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
                if (this._parameterValues && (JSON.stringify(this._parameterValues) === JSON.stringify(parameterValues))) {
                    return;
                }
                this._parameterValues = parameterValues;
                p = new Vec2(this._parameterValues);

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
                if (this._parameterValues && (JSON.stringify(this._parameterValues) === JSON.stringify(parameterValues))) {
                    return;
                }
                this._parameterValues = parameterValues;
                p = new Vec2(this._parameterValues);


                weightSum = 0.0;
                for (i = 0; i < this._children.length; i++) {
                    pi = this._children[i].point.clone();
                    minj = Number.MAX_VALUE;
                    for (j = 0; j < this._children.length; j++) {
                        if (i === j) continue;
                        pj = this._children[j].point.clone();
                        var pipAngle = getAngleRad(pi, p);
                        var pipjAngle = getAngleRad(pi, pj);
                        pipj = new Vec2((pj.length() - pi.length()) / ((pj.length() + pi.length()) / 2), pipjAngle * 2.0);
                        pip = new Vec2((p.length() - pi.length()) / ((pj.length() + pi.length()) / 2), pipAngle * 2.0);
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
                weightSum = 0.0;
                for (i = 0; i < this._children.length; i++) {
                    weightSum += clamp(this._parameterValues[i], 0.0, Number.MAX_VALUE);
                }
                for (i = 0; i < this._children.length; i++) {
                    this._children[i].weight = clamp(this._parameterValues[i], 0.0, Number.MAX_VALUE) / weightSum;
                }
                break;
            }
        }
    }

    getNodeCount() {
        var count = 0;
        for (var i = 0; i < this._children.length; i++) {
            var child = this._children[i];
            if (child.constructor === AnimBlendTree) {
                count += this._children[i].getNodeCount();
            } else {
                count++;
            }
        }
        return count;
    }
}

export { AnimBlendTree };
