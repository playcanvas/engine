import { math } from '../../../core/math/math.js';

import { AnimBlendTree } from './anim-blend-tree.js';

/**
 * An AnimBlendTree that calculates its weights using a 1D algorithm based on the thesis
 * http://runevision.com/thesis/rune_skovbo_johansen_thesis.pdf Chapter 6.
 *
 * @ignore
 */
class AnimBlendTree1D extends AnimBlendTree {
    /**
     * Create a new BlendTree1D instance.
     *
     * @param {import('./anim-state.js').AnimState} state - The AnimState that this AnimBlendTree
     * belongs to.
     * @param {AnimBlendTree|null} parent - The parent of the AnimBlendTree. If not null, the
     * AnimNode is stored as part of a {@link AnimBlendTree} hierarchy.
     * @param {string} name - The name of the BlendTree. Used when assigning an {@link AnimTrack}
     * to its children.
     * @param {number|import('../../../core/math/vec2.js').Vec2} point - The coordinate/vector
     * that's used to determine the weight of this node when it's part of an {@link AnimBlendTree}.
     * @param {string[]} parameters - The anim component parameters which are used to calculate the
     * current weights of the blend trees children.
     * @param {object[]} children - The child nodes that this blend tree should create. Can either
     * be of type {@link AnimNode} or {@link BlendTree}.
     * @param {boolean} syncAnimations - If true, the speed of each blended animation will be
     * synchronized.
     * @param {Function} createTree - Used to create child blend trees of varying types.
     * @param {Function} findParameter - Used at runtime to get the current parameter values.
     */
    constructor(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter) {
        children.sort((a, b) => a.point - b.point);
        super(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
    }

    calculateWeights() {
        if (this.updateParameterValues()) return;
        let weightedDurationSum = 0.0;
        this._children[0].weight = 0.0;
        for (let i = 0; i < this._children.length; i++) {
            const c1 = this._children[i];
            if (i !== this._children.length - 1) {
                const c2 = this._children[i + 1];
                if (c1.point === c2.point) {
                    c1.weight = 0.5;
                    c2.weight = 0.5;
                } else if (math.between(this._parameterValues[0], c1.point, c2.point, true)) {
                    const child2Distance = Math.abs(c1.point - c2.point);
                    const parameterDistance = Math.abs(c1.point - this._parameterValues[0]);
                    const weight = (child2Distance - parameterDistance) / child2Distance;
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
            for (let i = 0; i < this._children.length; i++) {
                const child = this._children[i];
                child.weightedSpeed = child.animTrack.duration / child.absoluteSpeed / weightedDurationSum;
            }
        }
    }
}
export { AnimBlendTree1D };
