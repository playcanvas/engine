import { math } from '../../math/math.js';

import { AnimBlendTree } from './anim-blend-tree.js';

/**
 * @private
 * @class
 * @name AnimBlendTree1D
 * @classdesc An AnimBlendTree that calculates its weights using a 1D algorithm
 * based on the thesis http://runevision.com/thesis/rune_skovbo_johansen_thesis.pdf Chapter 6.
 * @description Create a new BlendTree1D.
 */
class AnimBlendTree1D extends AnimBlendTree {
    constructor(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter) {
        children.sort((a, b) => a.point - b.point);
        super(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
    }

    calculateWeights() {
        if (this.updateParameterValues()) return;
        var i;
        var weightedDurationSum = 0.0;
        this._children[0].weight = 0.0;
        for (i = 0; i < this._children.length; i++) {
            var c1 = this._children[i];
            if (i !== this._children.length - 1) {
                var c2 = this._children[i + 1];
                if (c1.point === c2.point) {
                    c1.weight = 0.5;
                    c2.weight = 0.5;
                } else if (math.between(this._parameterValues[0], c1.point, c2.point, true)) {
                    var child2Distance = Math.abs(c1.point - c2.point);
                    var parameterDistance = Math.abs(c1.point - this._parameterValues[0]);
                    var weight = (child2Distance - parameterDistance) / child2Distance;
                    c1.weight = weight;
                    c2.weight = (1.0 - weight);
                } else {
                    c2.weight = 0.0;
                }
            }
            if (this._syncAnimations) {
                weightedDurationSum += c1.animTrack.duration / c1.absoluteSpeed * c1.weight;
            }
        }
        if (this._syncAnimations) {
            for (i = 0; i < this._children.length; i++) {
                const child = this._children[i];
                child.weightedSpeed = child.animTrack.duration / child.absoluteSpeed / weightedDurationSum;
            }
        }
    }
}
export { AnimBlendTree1D };
