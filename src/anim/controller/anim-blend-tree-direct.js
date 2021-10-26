import { AnimBlendTree } from './anim-blend-tree.js';

/**
 * @private
 * @class
 * @name AnimBlendTreeDirect
 * @classdesc An AnimBlendTree that calculates normalized weight values based on the total weight.
 * @description Create a new BlendTree1D.
 */
class AnimBlendTreeDirect extends AnimBlendTree {
    calculateWeights() {
        if (this.updateParameterValues()) return;
        let weightSum = 0.0;
        let weightedDurationSum = 0.0;
        for (let i = 0; i < this._children.length; i++) {
            weightSum += Math.max(this._parameterValues[i], 0.0);
            if (this._syncAnimations) {
                const child = this._children[i];
                weightedDurationSum += child.animTrack.duration / child.absoluteSpeed * child.weight;
            }
        }
        for (let i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            child.weight = Math.max(this._parameterValues[i], 0.0) / weightSum;
            if (this._syncAnimations) {
                child.weightedSpeed = child.animTrack.duration / child.absoluteSpeed / weightedDurationSum;
            }
        }
    }
}

export { AnimBlendTreeDirect };
