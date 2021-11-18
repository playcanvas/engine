import { ANIM_LAYER_OVERWRITE } from '../controller/constants.js';
import { AnimEvaluator } from '../evaluator/anim-evaluator.js';

/**
 * @private
 * @class
 * @name AnimTargetValue
 * @classdesc Used to store and update the value of an animation target. This combines the values of multiple layer targets into a single value.
 * @param {AnimComponent} component - The anim component this target value is associated with.
 * @param {string} type - The type of value stored, either quat or vec3.
 */
class AnimTargetValue {
    static TYPE_QUAT = 'quaternion';

    static TYPE_VEC3 = 'vector3';

    constructor(component, type) {
        this._component = component;
        this.mask = new Int8Array(component.layers.length);
        this.weights = new Float32Array(component.layers.length);
        this.totalWeight = 0;
        this.counter = 0;
        this.layerCounter = 0;
        this.valueType = type;
        this.dirty = true;
        this.value = [0, 0, 0, 1];
    }

    getWeight(index) {
        if (this.dirty) this.updateWeights();
        if (this.totalWeight === 0 || !this.mask[index]) {
            return 0;
        }
        return this.weights[index] / this.totalWeight;
    }

    setMask(index, value) {
        this.mask[index] = value;
        if (this._component.layers[index].blendType === ANIM_LAYER_OVERWRITE) {
            this.mask = this.mask.fill(0, 0, index);
        }
        this.dirty = true;
    }

    updateWeights() {
        this.totalWeight = 0;
        for (let i = 0; i < this.weights.length; i++) {
            this.weights[i] = this._component.layers[i].weight;
            this.totalWeight += this.mask[i] * this.weights[i];
        }
        this.dirty = false;
    }

    updateValue(index, value) {
        // always reset the value of the target when the counter is 0
        if (this.counter === 0) {
            this.value[0] = 0;
            this.value[1] = 0;
            this.value[2] = 0;
            this.value[3] = 1;
        }
        if (!this.mask[index]) return;
        if (this.counter === 0) {
            AnimEvaluator._set(this.value, value, this.valueType);
        } else {
            AnimEvaluator._blend(this.value, value, this.getWeight(index), this.valueType);
        }
    }
}

export {
    AnimTargetValue
};
