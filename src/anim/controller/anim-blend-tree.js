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
 * @param {Function} createTree - Used to create child blend trees of varying types.
 * @param {Function} findParameter - Used at runtime to get the current parameter values.
 */
class AnimBlendTree extends AnimNode {
    constructor(state, parent, name, point, parameters, children, createTree, findParameter) {
        super(state, parent, name, point);
        this._parameters = parameters;
        this._parameterValues = new Array(parameters.length);
        this._children = [];
        this._findParameter = findParameter;
        this._pointCache = {};
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child.children) {
                this._children.push(createTree(
                    child.type,
                    this,
                    null,
                    name,
                    1.0,
                    child.parameter ? [child.parameter] : child.parameters,
                    child.children,
                    createTree,
                    findParameter
                ));
            } else {
                this._children.push(new AnimNode(state, this, child.name, child.point, child.speed));
            }
        }
    }

    get weight() {
        this.calculateWeights();
        return this._parent ? this._parent.weight * this._weight : this._weight;
    }

    getChild(name) {
        for (var i = 0; i < this._children.length; i++) {
            if (this._children[i].name === name) return this._children[i];
        }
    }

    updateParameterValues() {
        var paramsEqual = true;
        for (let i = 0; i < this._parameterValues.length; i++) {
            var updatedParameter = this._findParameter(this._parameters[i]).value;
            if (this._parameterValues[i] !== updatedParameter) {
                this._parameterValues[i] = updatedParameter;
                paramsEqual = false;
            }
        }
        return paramsEqual;
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
