import { Quat } from '../../../core/math/quat.js';
import { ANIM_LAYER_ADDITIVE, ANIM_LAYER_OVERWRITE } from '../controller/constants.js';
import { AnimBlend } from './anim-blend.js';
import { math } from '../../../core/math/math.js';

/**
 * @import { AnimComponent } from '../../components/anim/component.js'
 */

/**
 * Used to store and update the value of an animation target. This combines the values of multiple
 * layer targets into a single value.
 */
class AnimTargetValue {
    static TYPE_QUAT = 'quaternion';

    static TYPE_VEC3 = 'vector3';

    static q1 = new Quat();

    static q2 = new Quat();

    static q3 = new Quat();

    static quatArr = [0, 0, 0, 1];

    static vecArr = [0, 0, 0];

    static IDENTITY_QUAT_ARR = [0, 0, 0, 1];

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
        this._accumulatedWeight = 0;
        this.valueType = type;
        this.dirty = true;
        this.value = (type === AnimTargetValue.TYPE_QUAT ? [0, 0, 0, 1] : [0, 0, 0]);
        this.baseValue = null;
        this.setter = null;
    }

    get _normalizeWeights() {
        return this._component.normalizeWeights;
    }

    getWeight(index) {
        if (this.dirty) this.updateWeights();
        if (this._normalizeWeights && this.totalWeight === 0 || !this.mask[index]) {
            return 0;
        } else if (this._normalizeWeights) {
            return this.weights[index] / this.totalWeight;
        }
        return math.clamp(this.weights[index], 0, 1);
    }

    _layerBlendType(index) {
        return this._component.layers[index].blendType;
    }

    setMask(index, value) {
        this.mask[index] = value;
        if (this._normalizeWeights) {
            if (this._component.layers[index].blendType === ANIM_LAYER_OVERWRITE) {
                this.mask = this.mask.fill(0, 0, index);
            }
            this.dirty = true;
        }
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
        const normalizeWeights = this._normalizeWeights;
        const blendType = this._layerBlendType(index);
        // fast path: when a single fully weighted overwrite layer drives this target, the blended
        // result is the layer value itself, so skip resetting and blending with the base value
        if (this.layerCounter === 1 && this.mask[index] &&
            blendType === ANIM_LAYER_OVERWRITE && this.getWeight(index) === 1 &&
            (!normalizeWeights || this._component.layers.length === 1)) {
            // the evaluator already normalized the value, so it is passed to the setter as is
            if (this.setter) this.setter(value);
            return;
        }

        // Reset for a new frame, or discard lower layers when an overwrite layer takes over.
        if (this.counter === 0 || (normalizeWeights && blendType === ANIM_LAYER_OVERWRITE)) {
            this._accumulatedWeight = 0;
            if (normalizeWeights) {
                this.value.fill(0);
            } else {
                AnimBlend.set(this.value, AnimTargetValue.IDENTITY_QUAT_ARR, this.valueType);
                AnimBlend.blend(this.value, this.baseValue, 1, this.valueType);
            }
        }
        if (!this.mask[index] || this.getWeight(index) === 0) return;
        if (normalizeWeights) {
            // Layers can bind this target during the update, so accumulate raw weights instead of
            // weights normalized against a total which can still change later in the frame.
            const weight = this.weights[index];
            this._accumulatedWeight += weight;
            if (this.valueType === AnimTargetValue.TYPE_QUAT) {
                AnimBlend.blend(this.value, value, weight, this.valueType, true);
            } else {
                AnimBlend.blend(this.value, value, weight / this._accumulatedWeight, this.valueType);
            }
        } else if (blendType === ANIM_LAYER_ADDITIVE) {
            if (this.valueType === AnimTargetValue.TYPE_QUAT) {
                // current value
                const v = AnimTargetValue.q1.set(this.value[0], this.value[1], this.value[2], this.value[3]);
                // additive value
                const aV1 = AnimTargetValue.q2.set(this.baseValue[0], this.baseValue[1], this.baseValue[2], this.baseValue[3]);
                const aV2 = AnimTargetValue.q3.set(value[0], value[1], value[2], value[3]);
                const aV = aV1.invert().mul(aV2);
                // scale additive value by it's weight
                aV.slerp(Quat.IDENTITY, aV, this.getWeight(index));
                // add the additive value onto the current value then set it to the targets value
                v.mul(aV);
                AnimTargetValue.quatArr[0] = v.x;
                AnimTargetValue.quatArr[1] = v.y;
                AnimTargetValue.quatArr[2] = v.z;
                AnimTargetValue.quatArr[3] = v.w;
                AnimBlend.set(this.value, AnimTargetValue.quatArr, this.valueType);
            } else {
                AnimTargetValue.vecArr[0] = value[0] - this.baseValue[0];
                AnimTargetValue.vecArr[1] = value[1] - this.baseValue[1];
                AnimTargetValue.vecArr[2] = value[2] - this.baseValue[2];
                AnimBlend.blend(this.value, AnimTargetValue.vecArr, this.getWeight(index), this.valueType, true);
            }
        } else {
            AnimBlend.blend(this.value, value, this.getWeight(index), this.valueType);
        }
        if (this.setter) {
            if (normalizeWeights && this.valueType === AnimTargetValue.TYPE_QUAT) {
                // Normalize the output without changing the sum used to blend subsequent layers.
                AnimBlend.set(AnimTargetValue.quatArr, this.value, this.valueType);
                this.setter(AnimTargetValue.quatArr);
            } else {
                this.setter(this.value);
            }
        }
    }

    unbind() {
        if (this.setter) {
            this.setter(this.baseValue);
        }
    }
}

export {
    AnimTargetValue
};
