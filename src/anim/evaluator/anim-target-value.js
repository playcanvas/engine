import { Vec3 } from '../../index.js';
import { Quat } from '../../math/quat.js';
import { ANIM_LAYER_ADDITIVE } from '../controller/constants.js';
import { AnimEvaluator } from '../evaluator/anim-evaluator.js';

/**
 * Used to store and update the value of an animation target. This combines the values of multiple
 * layer targets into a single value.
 *
 * @ignore
 */
class AnimTargetValue {
    static TYPE_QUAT = 'quaternion';

    static TYPE_VEC3 = 'vector3';

    static q1 = new Quat();

    static q2 = new Quat();

    static q3 = new Quat();

    static v1 = new Vec3();

    static v2 = new Vec3();

    /**
     * Create a new AnimTargetValue instance.
     *
     * @param {AnimComponent} component - The anim component this target value is associated with.
     * @param {string} type - The type of value stored, either quat or vec3.
     */
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
        this.baseValue = null;
        this.setter = null;
    }

    getWeight(index) {
        if (this.dirty) this.updateWeights();
        if (!this.mask[index]) return 0;
        if (this._layerNormalizedWeight(index)) {
            if (this.totalWeight === 0) {
                return 0;
            }
            return this.weights[index] / this.totalWeight;
        }
        return this.weights[index];
    }

    _layerblendType(index) {
        return this._component.layers[index].blendType;
    }

    _layerNormalizedWeight(index) {
        return this._component.layers[index].normalizedWeight;
    }

    setMask(index, value) {
        this.mask[index] = value;
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
            AnimEvaluator._set(this.value, this.baseValue, this.valueType);
        }
        if (!this.mask[index]) return;
        if (this._layerblendType(index) === ANIM_LAYER_ADDITIVE) {
            if (this.valueType === AnimTargetValue.TYPE_QUAT) {
                // current value
                const v = AnimTargetValue.q1.set(...this.value);
                // additive value
                const aV = AnimTargetValue.q2.set(...this.baseValue).invert().mul(AnimTargetValue.q3.set(...value));
                // scale additive value by it's weight
                aV.slerp(Quat.IDENTITY, aV, this.getWeight(index));
                // add the additive value onto the current value then set it to the targets value
                v.mul(aV);
                AnimEvaluator._set(this.value, [v.x, v.y, v.z, v.w], this.valueType);
            } else {
                const addValue = AnimTargetValue.v1.set(...value).sub(AnimTargetValue.v2.set(...this.baseValue));
                AnimEvaluator._blend(this.value, [addValue.x, addValue.y, addValue.z], this.getWeight(index), this.valueType, true);
            }
        } else {
            AnimEvaluator._blend(this.value, value, this.getWeight(index), this.valueType);
        }
        this.setter(this.value);
    }

    unbind() {
        this.setter(this.baseValue);
    }
}

export {
    AnimTargetValue
};
