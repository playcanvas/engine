import { Vec2 } from '../../math/vec2.js';

import { AnimNode } from './anim-node.js';

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
 * @param {string[]} parameters - The anim component parameters which are used to calculate the current weights of the blend trees children.
 * @param {object[]} children - The child nodes that this blend tree should create. Can either be of type {@link AnimNode} or {@link BlendTree}.
 * @param {Function} findParameter - Used at runtime to get the current parameter values.
 */
class AnimBlendTree extends AnimNode {
    constructor(state, parent, name, point, parameters, children, findParameter) {
        super(state, parent, name, point);
        this._parameters = parameters;
        this._parameterValues = null;
        this._children = [];
        this._findParameter = findParameter;
        this._p = new Vec2();
        this._pip = new Vec2();
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

    currentParameterValues() {
        return this._parameters.map(function (param) {
            return this._findParameter(param).value;
        }.bind(this));
    }

    parametersEqual(updatedParameters) {
        if (!this._parameterValues) return false;
        for (let i = 0; i < updatedParameters.length; i++) {
            if (this._parameterValues[i] !== updatedParameters[i]) {
                return false;
            }
        }
        return true;
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

    static between(num, a, b, inclusive) {
        var min = Math.min(a, b),
            max = Math.max(a, b);
        return inclusive ? num >= min && num <= max : num > min && num < max;
    }

    static getAngleRad(a, b) {
        return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
    }

    static clamp(num, min, max) {
        return num <= min ? min : num >= max ? max : num;
    }

}

/**
 * @private
 * @class
 * @name AnimBlendTree1D
 * @classdesc An AnimBlendTree that calculates it's weights using a 1D algorithm
 * @description Create a new BlendTree1D.
 */
class AnimBlendTree1D extends AnimBlendTree {
    calculateWeights() {
        var i;
        var parameterValue = this._findParameter(this._parameters[0]).value;
        if (this.parametersEqual([parameterValue])) return;
        this._parameterValues = [parameterValue];
        this._children[0].weight = 0.0;
        for (i = 0; i < this._children.length - 1; i++) {
            var c1 = this._children[i];
            var c2 = this._children[i + 1];
            if (AnimBlendTree.between(parameterValue, c1.point, c2.point, true)) {
                var child2Distance = Math.abs(c1.point - c2.point);
                var parameterDistance = Math.abs(c1.point - parameterValue);
                var weight = (child2Distance - parameterDistance) / child2Distance;
                c1.weight = weight;
                c2.weight = (1.0 - weight);
            } else {
                c2.weight = 0.0;
            }
        }
    }
}

/**
 * @private
 * @class
 * @name AnimBlendTreeCartesian2D
 * @classdesc An AnimBlendTree that calculates it's weights using a 2D catesian algorithm
 * @description Create a new BlendTree1D.
 */
class AnimBlendTreeCartesian2D extends AnimBlendTree {
    pointDistanceCache(i, j) {
        if (!this._pointCache) this._pointCache = {};
        var pointKey = `${i}${j}`;
        if (!this._pointCache[pointKey]) {
            this._pointCache[pointKey] = this._children[j].point.clone().sub(this._children[i].point);
        }
        return this._pointCache[pointKey];
    }

    calculateWeights() {
        var i, j, pi, parameterValues, minj, result, weightSum;
        parameterValues = this.currentParameterValues();
        if (this.parametersEqual(parameterValues)) return;
        this._parameterValues = parameterValues;
        this._p.set(this._parameterValues);
        weightSum = 0.0;
        for (i = 0; i < this._children.length; i++) {
            pi = this._children[i].point;
            minj = Number.MAX_VALUE;
            for (j = 0; j < this._children.length; j++) {
                if (i === j) continue;
                pipj = this.pointDistanceCache(i, j);
                this._pip = this._p.clone().sub(pi);
                result = clamp(1.0 - (this._pip.dot(pipj) / pipj.lengthSq()), 0.0, 1.0);
                if (result < minj) minj = result;
            }
            this._children[i].weight = minj;
            weightSum += minj;
        }
        for (i = 0; i < this._children.length; i++) {
            this._children[i].weight = this._children[i]._weight / weightSum;
        }
    }
}

/**
 * @private
 * @class
 * @name AnimBlendTreeDirectional2D
 * @classdesc An AnimBlendTree that calculates it's weights using a 2D directional algorithm
 * @description Create a new BlendTree1D.
 */
class AnimBlendTreeDirectional2D extends AnimBlendTree {
    pointAngleCache(i, j) {
        if (!this._pointCache) this._pointCache = {};
        var pointKey = `${i}${j}`;
        if (!this._pointCache[pointKey]) {
            this._pointCache[pointKey] = AnimBlendTree.getAngleRad(this._children[i].point, this._children[j].point);
        }
        return this._pointCache[pointKey];
    }

    pipjCache(i, j) {
        if (!this._pipjCache) this._pipjCache = {};
        var pointKey = `${i}${j}`;
        if (!this._pointCache[pointKey]) {
            this._pointCache[pointKey] = new Vec2(
                (this._children[j].pointLength - this._children[i].pointLength) / ((this._children[j].pointLength + this._children[i].pointLength) / 2),
                AnimBlendTree.getAngleRad(this._children[i].point, this._children[j].point) * 2.0
            );
        }
        return this._pointCache[pointKey];
    }

    calculateWeights() {
        var i, j, pi, pipj, parameterValues, minj, result, weightSum;
        parameterValues = this.currentParameterValues();
        if (this.parametersEqual(parameterValues)) return;
        this._parameterValues = parameterValues;
        this._p.set(this._parameterValues);
        var pLength = p.length();
        weightSum = 0.0;
        for (i = 0; i < this._children.length; i++) {
            pi = this._children[i].point;
            var piLength = this._children[i].pointLength;
            minj = Number.MAX_VALUE;
            for (j = 0; j < this._children.length; j++) {
                if (i === j) continue;
                var pjLength = this._children[j].pointLength;
                pipj = this.pipjCache(i, j);
                this._pip.set((pLength - piLength) / ((pjLength + piLength) / 2), AnimBlendTree.getAngleRad(pi, this._p) * 2.0);
                result = AnimBlendTree.clamp(1.0 - Math.abs((this._pip.dot(pipj) / pipj.lengthSq())), 0.0, 1.0);
                if (result < minj) minj = result;
            }
            this._children[i].weight = minj;
            weightSum += minj;
        }
        for (i = 0; i < this._children.length; i++) {
            this._children[i].weight = this._children[i]._weight / weightSum;
        }
    }
}


/**
 * @private
 * @class
 * @name AnimBlendTreeDirect
 * @classdesc An AnimBlendTree that calculates normalised weight values based on the total weight
 * @description Create a new BlendTree1D.
 */
class AnimBlendTreeDirect extends AnimBlendTree {
    calculateWeights() {
        var i, parameterValues, weightSum;
        parameterValues = this.currentParameterValues();
        if (this.parametersEqual(parameterValues)) return;
        this._parameterValues = parameterValues;
        weightSum = 0.0;
        for (i = 0; i < this._children.length; i++) {
            weightSum += AnimBlendTree.clamp(this._parameterValues[i], 0.0, Number.MAX_VALUE);
        }
        for (i = 0; i < this._children.length; i++) {
            this._children[i].weight = AnimBlendTree.clamp(this._parameterValues[i], 0.0, Number.MAX_VALUE) / weightSum;
        }
    }
}

export { AnimBlendTree1D, AnimBlendTreeCartesian2D, AnimBlendTreeDirectional2D, AnimBlendTreeDirect };
