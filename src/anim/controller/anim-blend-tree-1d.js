import { math } from '../../math/math.js';

import { AnimBlendTree } from './anim-blend-tree.js';

/**
 * @private
 * @class
 * @name AnimBlendTree1D
 * @classdesc An AnimBlendTree that calculates its weights using a 1D algorithm
 * @description Create a new BlendTree1D.
 */
class AnimBlendTree1D extends AnimBlendTree {
    constructor(state, parent, name, point, parameters, children, syncDurations, createTree, findParameter) {
        children.sort((a, b) => a.point - b.point);
        super(state, parent, name, point, parameters, children, syncDurations, createTree, findParameter);
    }

    calculateWeights() {
        if (this.updateParameterValues()) return;
        var i;
        this._children[0].weight = 0.0;
        for (i = 0; i < this._children.length - 1; i++) {
            var c1 = this._children[i];
            var c2 = this._children[i + 1];
            if (c1.point === c2.point) {
                c1.weight = 0.5;
                c2.weight = 0.5;
            } else if (math.between(parameterValue, c1.point, c2.point, true)) {
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
export { AnimBlendTree1D };
