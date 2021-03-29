import { Vec2 } from '../../math/vec2.js';
import { math } from '../../math/math.js';

import { AnimBlendTree } from './anim-blend-tree.js';

/**
 * @private
 * @class
 * @name AnimBlendTreeCartesian2D
 * @classdesc An AnimBlendTree that calculates its weights using a 2D Cartesian algorithm
 * based on the thesis http://runevision.com/thesis/rune_skovbo_johansen_thesis.pdf Chapter 6 Section 3
 * @description Create a new BlendTree1D.
 */
class AnimBlendTreeCartesian2D extends AnimBlendTree {

    static _p = new Vec2();

    static _pip = new Vec2();

    pointDistanceCache(i, j) {
        var pointKey = `${i}${j}`;
        if (!this._pointCache[pointKey]) {
            this._pointCache[pointKey] = this._children[j].point.clone().sub(this._children[i].point);
        }
        return this._pointCache[pointKey];
    }

    calculateWeights() {
        if (this.updateParameterValues()) return;
        var i, j, pi, pipj, minj, result, weightSum, weightedDurationSum;
        AnimBlendTreeCartesian2D._p.set(...this._parameterValues);
        weightSum = 0.0;
        weightedDurationSum = 0.0;
        for (i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            pi = child.point;
            AnimBlendTreeCartesian2D._pip.set(...AnimBlendTreeCartesian2D._p.data).sub(pi);
            minj = Number.MAX_VALUE;
            for (j = 0; j < this._children.length; j++) {
                if (i === j) continue;
                pipj = this.pointDistanceCache(i, j);
                result = math.clamp(1.0 - (AnimBlendTreeCartesian2D._pip.dot(pipj) / pipj.lengthSq()), 0.0, 1.0);
                if (result < minj) minj = result;
            }
            child.weight = minj;
            weightSum += minj;
            if (this._syncAnimations) {
                weightedDurationSum += child.animTrack.duration / child.absoluteSpeed * child.weight;
            }
        }
        for (i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            child.weight = child._weight / weightSum;
            if (this._syncAnimations) {
                child.weightedSpeed = child.animTrack.duration / child.absoluteSpeed / weightedDurationSum;
            }
        }
    }
}

export { AnimBlendTreeCartesian2D };
