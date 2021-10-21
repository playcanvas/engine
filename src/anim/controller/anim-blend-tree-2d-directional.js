import { Vec2 } from '../../math/vec2.js';
import { math } from '../../math/math';

import { AnimBlendTree } from './anim-blend-tree.js';

/**
 * @private
 * @class
 * @name AnimBlendTreeDirectional2D
 * @classdesc An AnimBlendTree that calculates its weights using a 2D directional algorithm
 * based on the thesis http://runevision.com/thesis/rune_skovbo_johansen_thesis.pdf Chapter 6.
 * @description Create a new BlendTree1D.
 */
class AnimBlendTreeDirectional2D extends AnimBlendTree {
    static _p = new Vec2();

    static _pip = new Vec2();

    pointCache(i, j) {
        const pointKey = `${i}${j}`;
        if (!this._pointCache[pointKey]) {
            this._pointCache[pointKey] = new Vec2(
                (this._children[j].pointLength - this._children[i].pointLength) / ((this._children[j].pointLength + this._children[i].pointLength) / 2),
                Vec2.angleRad(this._children[i].point, this._children[j].point) * 2.0
            );
        }
        return this._pointCache[pointKey];
    }

    calculateWeights() {
        if (this.updateParameterValues()) return;
        let weightSum, weightedDurationSum;
        AnimBlendTreeDirectional2D._p.set(...this._parameterValues);
        const pLength = AnimBlendTreeDirectional2D._p.length();
        weightSum = 0.0;
        weightedDurationSum = 0.0;
        for (let i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            const pi = child.point;
            const piLength = child.pointLength;
            let minj = Number.MAX_VALUE;
            for (let j = 0; j < this._children.length; j++) {
                if (i === j) continue;
                const pipj = this.pointCache(i, j);
                const pjLength = this._children[j].pointLength;
                AnimBlendTreeDirectional2D._pip.set((pLength - piLength) / ((pjLength + piLength) / 2), Vec2.angleRad(pi, AnimBlendTreeDirectional2D._p) * 2.0);
                const result = math.clamp(1.0 - Math.abs((AnimBlendTreeDirectional2D._pip.dot(pipj) / pipj.lengthSq())), 0.0, 1.0);
                if (result < minj) minj = result;
            }
            child.weight = minj;
            weightSum += minj;
            if (this._syncAnimations) {
                weightedDurationSum += (child.animTrack.duration / child.absoluteSpeed) * child.weight;
            }
        }
        for (let i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            child.weight = child._weight / weightSum;
            if (this._syncAnimations) {
                const weightedChildDuration = (child.animTrack.duration / weightedDurationSum) * weightSum;
                child.weightedSpeed =  child.absoluteSpeed * weightedChildDuration;
            }
        }
    }
}

export { AnimBlendTreeDirectional2D };
