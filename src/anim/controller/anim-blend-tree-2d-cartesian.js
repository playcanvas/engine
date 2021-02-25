import { Vec2 } from '../../math/vec2.js';
import { math } from '../../math/math.js';

import { AnimBlendTree } from './anim-blend-tree.js';

/**
 * @private
 * @class
 * @name AnimBlendTreeCartesian2D
 * @classdesc An AnimBlendTree that calculates its weights using a 2D Cartesian algorithm
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
        var i, j, pi, pipj, minj, result, weightSum, meanDuration;
        AnimBlendTreeCartesian2D._p.set(...this._parameterValues);
        weightSum = 0.0;
        meanDuration = 0.0;
        for (i = 0; i < this._children.length; i++) {
            pi = this._children[i].point;
            minj = Number.MAX_VALUE;
            for (j = 0; j < this._children.length; j++) {
                if (i === j) continue;
                pipj = this.pointDistanceCache(i, j);
                AnimBlendTreeCartesian2D._pip = AnimBlendTreeCartesian2D._p.clone().sub(pi);
                result = math.clamp(1.0 - (AnimBlendTreeCartesian2D._pip.dot(pipj) / pipj.lengthSq()), 0.0, 1.0);
                if (result < minj) minj = result;
            }
            this._children[i].weight = minj;
            weightSum += minj;
            if (this._syncDurations) {
                meanDuration += this._children[i].weightedDuration;
            }
        }
        for (i = 0; i < this._children.length; i++) {
            this._children[i].weight = this._children[i]._weight / weightSum;
            if (this._syncDurations) {
                this._children[i].weightedSpeed = meanDuration;
            }
        }
    }
}

export { AnimBlendTreeCartesian2D };
