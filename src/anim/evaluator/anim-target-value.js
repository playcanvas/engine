import { Quat } from '../../math/quat.js';
import { Vec3 } from '../../math/vec3.js';
import { ANIM_LAYER_OVERWRITE } from '../controller/constants.js';

/**
 * @private
 * @class
 * @name AnimTargetValue
 * @classdesc Used to store and update the value of an animation target. This combines the values of multiple layer targets into a single value.
 * @param {AnimComponent} component - The anim component this target value is associated with.
 * @param {string} type - The type of value stored, either quat or vec3.
 */
class AnimTargetValue {
    constructor(component, type) {
        this._component = component;
        this.mask = new Int8Array(component.layers.length);
        this.weights = new Float32Array(component.layers.length);
        this.totalWeight = 0;
        this.counter = 0;
        this.layerCounter = 0;
        this.valueType = type;
        this.dirty = true;

        if (this.valueType === AnimTargetValue.TYPE_QUAT) {
            this.value = new Quat();
            this._currentValue = new Quat();
        } else {
            this.value = new Vec3();
            this._currentValue = new Vec3();
        }
    }

    getWeight(index) {
        if (this.dirty) this.updateWeights();
        if (this.totalWeight === 0) return 0;
        return this.weights[index] / this.totalWeight;
    }

    setMask(index, value) {
        this.mask[index] = value;
        if (this._component.layers[index].blendType === ANIM_LAYER_OVERWRITE) {
            this.mask = this.mask.fill(0, 0, index - 1);
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
        if (this.counter === 0) {
            this.value.set(0, 0, 0, 1);
        }
        this._currentValue.set(...value);
        switch (this.valueType) {
            case (AnimTargetValue.TYPE_QUAT): {
                this.value.mul(this._currentValue.slerp(Quat.IDENTITY, this._currentValue, this.getWeight(index)));
                break;
            }
            case (AnimTargetValue.TYPE_VEC3): {
                this.value.add(this._currentValue.mulScalar(this.getWeight(index)));
                break;
            }
        }
    }
}

AnimTargetValue.TYPE_QUAT = 'QUATERNION';
AnimTargetValue.TYPE_VEC3 = 'VECTOR3';

export {
    AnimTargetValue
};
