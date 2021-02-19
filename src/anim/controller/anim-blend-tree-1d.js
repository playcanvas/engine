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
    constructor(state, parent, name, point, parameters, children, createTree, findParameter) {
        children.sort((a, b) => a.point - b.point);
        super(state, parent, name, point, parameters, children, createTree, findParameter);
    }

    calculateWeights() {
        if (this.updateParameterValues()) return;
        var i;
        var meanDuration = 0.0;
        this._children[0].weight = 0.0;
        for (i = 0; i < this._children.length; i++) {
            if (i !== this._children.length - 1) {
                var c1 = this._children[i];
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
            if (this._syncDurations) {
                meanDuration += this._children[i].animTrack.duration * this._children[i].weight;
            }
        }
        if (this._syncDurations) {
            for (i = 0; i < this._children.length; i++) {
                this._children[i]._weightedSpeed = this._children[i].animTrack.duration / meanDuration;
            }
        }
    }
}
export { AnimBlendTree1D };
