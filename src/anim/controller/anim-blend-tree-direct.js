import { AnimBlendTree } from './anim-blend-tree.js';

/**
 * @private
 * @class
 * @name AnimBlendTreeDirect
 * @classdesc An AnimBlendTree that calculates normalised weight values based on the total weight
 * @description Create a new BlendTree1D.
 */
class AnimBlendTreeDirect extends AnimBlendTree {
    calculateWeights() {
        if (this.updateParameterValues()) return;
        var i;
        var weightSum = 0.0;
        var weightedDurationSum = 0.0;
        for (i = 0; i < this._children.length; i++) {
            weightSum += Math.max(this._parameterValues[i], 0.0);
            if (this._syncAnimations) {
                const child = this._children[i];
                weightedDurationSum += child.animTrack.duration / child.absoluteSpeed * child.weight;
            }
        }
        for (i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            child.weight = Math.max(this._parameterValues[i], 0.0) / weightSum;
            if (this._syncAnimations) {
                child.weightedSpeed = child.animTrack.duration / child.absoluteSpeed / weightedDurationSum;
            }
        }
    }
}

export { AnimBlendTreeDirect };
